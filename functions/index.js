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
