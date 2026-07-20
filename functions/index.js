const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Simple daily cap per user, so a leaked link or a runaway loop can't run up the bill.
// Bump this if it turns out to be too tight for real usage.
const DAILY_REQUEST_LIMIT = 300;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, resets at UTC midnight
}

exports.claudeProxy = onRequest(
  {
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // ---- verify the caller is a signed-in Firebase user ----
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }
    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(match[1]);
      uid = decoded.uid;
    } catch (err) {
      logger.warn('Token verification failed', err);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // ---- reject disabled accounts immediately ----
    // verifyIdToken() alone doesn't check disabled status — a valid, unexpired token from a
    // disabled account would otherwise still pass. Checking the live account record here means
    // disabling someone in the Firebase Console takes effect on their very next request, not
    // whenever their existing token happens to expire.
    try {
      const userRecord = await admin.auth().getUser(uid);
      if (userRecord.disabled) {
        res.status(403).json({ error: 'This account has been disabled.' });
        return;
      }
    } catch (err) {
      logger.error('Account status check failed', err);
      res.status(500).json({ error: 'Internal error checking account status' });
      return;
    }

    // ---- per-user daily rate limit ----
    const usageRef = db.collection('usage').doc(`${uid}_${todayKey()}`);
    try {
      const newCount = await db.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const current = snap.exists ? snap.data().count || 0 : 0;
        if (current >= DAILY_REQUEST_LIMIT) {
          throw new Error('RATE_LIMIT');
        }
        tx.set(usageRef, { count: current + 1, uid, day: todayKey() }, { merge: true });
        return current + 1;
      });
      logger.info(`Request ${newCount}/${DAILY_REQUEST_LIMIT} today for uid ${uid}`);
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        res.status(429).json({ error: 'Daily usage limit reached. Please try again tomorrow.' });
        return;
      }
      logger.error('Rate-limit check failed', err);
      res.status(500).json({ error: 'Internal error checking usage limit' });
      return;
    }

    // ---- forward the request to Anthropic ----
    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(req.body),
      });
      const text = await upstream.text();
      res.status(upstream.status).set('Content-Type', 'application/json').send(text);
    } catch (err) {
      logger.error('Upstream Anthropic call failed', err);
      res.status(502).json({ error: 'Could not reach the Anthropic API' });
    }
  }
);

// Recipe pages almost always advertise their hero photo via an <meta property="og:image">
// (or twitter:image) tag — that's a real, deterministic value the page itself set, not a guess.
// Asking Claude to find "the main photo URL" via web_search was unreliable (it has to infer a
// URL from search snippets rather than read the page directly), which is why some sites — like
// BBC Good Food — often came back with no image even though one clearly existed. This fetches
// the page server-side (browsers can't do this cross-origin due to CORS) and reads the tag
// directly. No AI call, so it doesn't touch the Anthropic key or the daily usage cap.
exports.fetchPageImage = onRequest(
  { region: 'europe-west2', cors: true, timeoutSeconds: 20, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(match[1]);
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const targetUrl = req.body && req.body.url;
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      res.status(400).json({ error: 'A valid http(s) url is required' });
      return;
    }

    try {
      const pageRes = await fetch(targetUrl, {
        headers: {
          // A generic browser-like UA — some sites reject requests with no UA at all.
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeBoxImageBot/1.0)',
        },
        redirect: 'follow',
      });
      if (!pageRes.ok || !pageRes.body) {
        res.status(200).json({ imageUrl: '' }); // fail soft — client falls back to Claude's guess
        return;
      }

      // og/twitter tags are almost always in <head>, so stop reading as soon as we see it (or
      // after a reasonable byte cap) rather than downloading the whole article page.
      const reader = pageRes.body.getReader();
      const decoder = new TextDecoder();
      let html = '';
      let bytesRead = 0;
      const maxBytes = 250000;
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});

      const metaTagRe = /<meta\s+[^>]*>/gi;
      let ogImage = '';
      let twitterImage = '';
      let match2;
      while ((match2 = metaTagRe.exec(html))) {
        const tag = match2[0];
        const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
        const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
        if (!propMatch || !contentMatch) continue;
        const prop = propMatch[1].toLowerCase();
        if (prop === 'og:image' && !ogImage) ogImage = contentMatch[1];
        if (prop === 'twitter:image' && !twitterImage) twitterImage = contentMatch[1];
      }

      let imageUrl = ogImage || twitterImage || '';
      if (imageUrl) {
        try {
          imageUrl = new URL(imageUrl, targetUrl).href; // resolve relative URLs against the page
        } catch {
          imageUrl = '';
        }
      }
      res.status(200).json({ imageUrl });
    } catch (err) {
      logger.error('fetchPageImage failed', err);
      res.status(200).json({ imageUrl: '' }); // fail soft — client falls back to Claude's guess
    }
  }
);

// ---------- video URL -> recipe text ----------
// Reads a YouTube/TikTok/Instagram page server-side (CORS blocks this from the browser) and
// returns whatever transcript/caption/description text can be found, plus a thumbnail. No AI
// call happens here — the client sends the resulting text to claudeProxy as a separate step,
// the same way pasted recipe text is handled.
//
// YouTube: the caption track and full (untruncated) description both live inside a JSON blob
// (ytInitialPlayerResponse) embedded in the watch page — there's no official public API for
// either. TikTok/Instagram: no caption/transcript data is publicly readable at all, so this
// only reads the page's og:description meta tag (the post caption) — genuinely spoken content
// with no matching caption text won't be captured. Instagram in particular often blocks
// non-browser requests outright, so this is best-effort there.
function getYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

// Finds `marker` in `html`, then scans forward from the next "{" counting brace depth to find
// the matching close — more robust than a regex against deeply nested JSON that may itself
// contain braces inside strings.
function extractBalancedJson(html, marker) {
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;
  const start = html.indexOf('{', markerIdx);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function extractYouTubeText(url) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) {
    return { platform: 'youtube', title: '', text: '', imageUrl: '', error: "Couldn't find a video ID in that YouTube link." };
  }

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!pageRes.ok) {
    return { platform: 'youtube', title: '', text: '', imageUrl: '', error: `Couldn't load that video page (HTTP ${pageRes.status}).` };
  }
  const html = await pageRes.text();

  const playerJson = extractBalancedJson(html, 'ytInitialPlayerResponse');
  let title = '';
  let description = '';
  let captionTracks = [];
  if (playerJson) {
    try {
      const parsed = JSON.parse(playerJson);
      title = parsed?.videoDetails?.title || '';
      description = parsed?.videoDetails?.shortDescription || '';
      captionTracks = parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch (err) {
      logger.warn('extractYouTubeText: could not parse ytInitialPlayerResponse', err);
    }
  }

  let transcript = '';
  if (captionTracks.length) {
    const track =
      captionTracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ||
      captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
      captionTracks[0];
    if (track?.baseUrl) {
      try {
        const capRes = await fetch(track.baseUrl, { headers: { 'User-Agent': BROWSER_UA } });
        if (capRes.ok) {
          const xml = await capRes.text();
          transcript = decodeHtmlEntities(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        }
      } catch (err) {
        logger.warn('extractYouTubeText: caption fetch failed', err);
      }
    }
  }

  const text = [description.trim(), transcript ? `Video transcript:\n${transcript}` : '']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 20000);

  const imageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (!text) {
    return { platform: 'youtube', title, text: '', imageUrl, error: 'No captions or description could be found for this video.' };
  }
  return { platform: 'youtube', title, text, imageUrl, error: '' };
}

async function extractCaptionPageText(url, platform) {
  let html = '';
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });
    if (!pageRes.ok || !pageRes.body) {
      return {
        platform, title: '', text: '', imageUrl: '',
        error: `Couldn't load that page (HTTP ${pageRes.status || 'unknown'}).${platform === 'instagram' ? ' Instagram often blocks this outside the app.' : ''}`,
      };
    }
    const reader = pageRes.body.getReader();
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 900000; // caption data can sit fairly deep in these pages
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.length;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
  } catch (err) {
    logger.warn(`extractCaptionPageText (${platform}): fetch failed`, err);
    return { platform, title: '', text: '', imageUrl: '', error: 'Could not reach that page.' };
  }

  const metaTagRe = /<meta\s+[^>]*>/gi;
  let ogTitle = '';
  let ogDescription = '';
  let ogImage = '';
  let m;
  while ((m = metaTagRe.exec(html))) {
    const tag = m[0];
    const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (!propMatch || !contentMatch) continue;
    const prop = propMatch[1].toLowerCase();
    if (prop === 'og:title' && !ogTitle) ogTitle = contentMatch[1];
    if (prop === 'og:description' && !ogDescription) ogDescription = contentMatch[1];
    if (prop === 'og:image' && !ogImage) ogImage = contentMatch[1];
  }

  const text = decodeHtmlEntities(ogDescription).trim();
  let imageUrl = ogImage;
  if (imageUrl) {
    try { imageUrl = new URL(imageUrl, url).href; } catch { imageUrl = ''; }
  }

  if (!text) {
    return {
      platform, title: decodeHtmlEntities(ogTitle), text: '', imageUrl,
      error: `Couldn't find a caption on that page — ${platform === 'instagram' ? 'Instagram' : 'TikTok'} often blocks this kind of request outside the app. Try opening the video, copying the caption text, and pasting it here instead.`,
    };
  }
  return { platform, title: decodeHtmlEntities(ogTitle), text, imageUrl, error: '' };
}

exports.extractVideoText = onRequest(
  { region: 'europe-west2', cors: true, timeoutSeconds: 30, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(match[1]);
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const targetUrl = req.body && req.body.url;
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      res.status(400).json({ error: 'A valid http(s) url is required' });
      return;
    }

    let hostname = '';
    try {
      hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {
      res.status(400).json({ error: 'Not a valid URL' });
      return;
    }

    try {
      if (/(^|\.)youtube\.com$/.test(hostname) || hostname === 'youtu.be') {
        res.status(200).json(await extractYouTubeText(targetUrl));
      } else if (/(^|\.)tiktok\.com$/.test(hostname)) {
        res.status(200).json(await extractCaptionPageText(targetUrl, 'tiktok'));
      } else if (/(^|\.)instagram\.com$/.test(hostname)) {
        res.status(200).json(await extractCaptionPageText(targetUrl, 'instagram'));
      } else {
        res.status(200).json({ platform: 'unknown', title: '', text: '', imageUrl: '', error: "That doesn't look like a YouTube, TikTok, or Instagram link." });
      }
    } catch (err) {
      logger.error('extractVideoText failed', err);
      res.status(200).json({ platform: 'unknown', title: '', text: '', imageUrl: '', error: 'Something went wrong reading that page.' });
    }
  }
);
