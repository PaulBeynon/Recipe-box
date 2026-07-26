import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera, Search, X, Plus, Loader2, ChefHat, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, Pencil, Download, Minus, Utensils, ImagePlus, Check,
  Cookie, Fish, Beef, Salad, Soup, Pizza, Croissant, Egg, Wine, BookOpen, LayoutGrid, Star, Clock,
  ShoppingCart, CheckSquare, Square, ListPlus, Sparkles, Play, Pause, RotateCcw, Calendar, Copy, ExternalLink,
  Upload, Globe, Leaf, LogOut, Mic, MicOff, Layers,
} from 'lucide-react';
import { CLOUD_FUNCTION_URL, FETCH_PAGE_IMAGE_URL, EXTRACT_VIDEO_TEXT_URL, auth } from './firebase-init';

// Every Anthropic API call is routed through our own Cloud Function rather than
// api.anthropic.com directly — the function holds the real API key server-side and
// checks this token to confirm the caller is a signed-in user before forwarding the
// request, so the key is never exposed to the browser and requests can't be run by
// anyone who isn't signed in.
async function getAuthedHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH: You need to be signed in to do that.');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const COLORS = {
  paper: '#FAF3E4',
  paperDark: '#F0E6D0',
  ink: '#2B2620',
  inkFaint: '#6B6255',
  rust: '#B8451F',
  rustDark: '#8F3416',
  sage: '#748B6B',
  mustard: '#C98A2C',
  cardBorder: '#D8CBB0',
  cream: '#FFFDF8',
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');`;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Rough UK seasonal availability by month (1 = January ... 12 = December). Not exhaustive —
// just enough common ingredients to give a useful nudge, not a definitive almanac.
const UK_SEASONAL_PRODUCE = {
  'asparagus': [4, 5, 6],
  'rhubarb': [1, 2, 3, 4, 5],
  'purple sprouting broccoli': [2, 3, 4],
  'wild garlic': [3, 4, 5],
  'elderflower': [5, 6],
  'strawberries': [6, 7, 8],
  'raspberries': [7, 8, 9],
  'gooseberries': [6, 7],
  'broad beans': [6, 7, 8],
  'runner beans': [7, 8, 9],
  'peas': [6, 7, 8],
  'courgette': [6, 7, 8, 9],
  'sweetcorn': [8, 9],
  'blackberries': [8, 9, 10],
  'plums': [8, 9, 10],
  'damsons': [9, 10],
  'pumpkin': [9, 10, 11],
  'squash': [9, 10, 11],
  'apples': [9, 10, 11],
  'pears': [9, 10, 11],
  'parsnips': [10, 11, 12, 1, 2],
  'swede': [10, 11, 12, 1, 2],
  'celeriac': [10, 11, 12, 1, 2],
  'jerusalem artichoke': [10, 11, 12, 1],
  'brussels sprouts': [10, 11, 12, 1],
  'sprouts': [10, 11, 12, 1],
  'leeks': [10, 11, 12, 1, 2, 3],
  'kale': [11, 12, 1, 2, 3],
  'cavolo nero': [11, 12, 1, 2],
  'red cabbage': [10, 11, 12, 1, 2],
  'beetroot': [6, 7, 8, 9, 10],
  'blackcurrants': [7, 8],
  'cherries': [6, 7, 8],
  'quince': [10, 11],
  'spring greens': [3, 4, 5],
  'rocket': [4, 5, 6, 7, 8, 9],
  'watercress': [4, 5, 6, 7, 8, 9],
};

// Scans a recipe's ingredient list for anything in the seasonal calendar above and splits
// matches into in-season / out-of-season for the current month. Purely a nudge, not a filter.
function getSeasonalMatches(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return { inSeason: [], outOfSeason: [] };
  const month = new Date().getMonth() + 1;
  const inSeason = [];
  const outOfSeason = [];
  const seen = new Set();
  ingredients.forEach((ing) => {
    const clean = stripQuantityForSearch(ing).toLowerCase();
    Object.keys(UK_SEASONAL_PRODUCE).forEach((key) => {
      if (seen.has(key) || !clean.includes(key)) return;
      seen.add(key);
      (UK_SEASONAL_PRODUCE[key].includes(month) ? inSeason : outOfSeason).push(key);
    });
  });
  return { inSeason, outOfSeason };
}

// A small, static "World Kitchen" spotlight — not tied to the user's own library, just a
// daily bit of food-culture trivia (kid-friendly) that rotates deterministically by date.
const NATIONAL_DISHES = [
  { flag: '🇮🇹', country: 'Italy', dish: 'Ragù alla Bolognese', fact: "Traditionally simmered for hours and served with tagliatelle — not spaghetti!" },
  { flag: '🇯🇵', country: 'Japan', dish: 'Curry Rice (Kar\u0113 Raisu)', fact: 'Curry arrived in Japan via the British Navy in the 1800s and became a total classic.' },
  { flag: '🇲🇽', country: 'Mexico', dish: 'Mole Poblano', fact: 'This rich sauce can have over 20 ingredients, including a little chocolate.' },
  { flag: '🇮🇳', country: 'India', dish: 'Biryani', fact: 'Every region has its own version — the rice, spices, and toppings all vary.' },
  { flag: '🇹🇭', country: 'Thailand', dish: 'Pad Thai', fact: "It was promoted as a national dish in the 1930s to encourage rice-noodle eating." },
  { flag: '🇫🇷', country: 'France', dish: 'Pot-au-Feu', fact: 'The name means "pot on the fire" — a simple beef-and-vegetable stew simmered slowly.' },
  { flag: '🇪🇸', country: 'Spain', dish: 'Paella', fact: 'It started as a farm-workers\u2019 lunch cooked over an open fire in Valencia.' },
  { flag: '🇬🇷', country: 'Greece', dish: 'Moussaka', fact: 'Layers of aubergine, spiced meat, and a creamy béchamel sauce on top.' },
  { flag: '🇹🇷', country: 'Turkey', dish: 'K\u00f6fte', fact: 'These spiced meatballs come in hundreds of regional varieties across the country.' },
  { flag: '🇲🇦', country: 'Morocco', dish: 'Tagine', fact: 'Named after the cone-shaped clay pot it\u2019s slow-cooked in.' },
  { flag: '🇰🇷', country: 'South Korea', dish: 'Bibimbap', fact: 'The name literally means "mixed rice" — everything gets stirred together at the table.' },
  { flag: '🇻🇳', country: 'Vietnam', dish: 'Ph\u1edf', fact: 'This noodle soup is traditionally eaten for breakfast, not dinner.' },
  { flag: '🇧🇷', country: 'Brazil', dish: 'Feijoada', fact: 'A hearty black bean and pork stew, usually served on Wednesdays and Saturdays.' },
  { flag: '🇦🇷', country: 'Argentina', dish: 'Asado', fact: 'Less a recipe, more a whole social event built around slow-grilled meat.' },
  { flag: '🇵🇹', country: 'Portugal', dish: 'Caldo Verde', fact: 'A simple potato and kale soup, often finished with a slice of spicy sausage.' },
  { flag: '🇭🇺', country: 'Hungary', dish: 'Gouly\u00e1s', fact: 'Originally a soup made by cattle herders, cooked in a big pot over a fire.' },
  { flag: '🇩🇪', country: 'Germany', dish: 'Sauerbraten', fact: 'The meat is marinated for days — sometimes over a week — before cooking.' },
  { flag: '🇵🇱', country: 'Poland', dish: 'Pierogi', fact: 'These dumplings can be sweet or savoury — fruit fillings are just as popular as meat.' },
  { flag: '🇪🇬', country: 'Egypt', dish: 'Koshari', fact: 'A carb-lover\u2019s dream: rice, lentils, pasta, and crispy fried onions all in one bowl.' },
  { flag: '🇳🇬', country: 'Nigeria', dish: 'Jollof Rice', fact: 'There\u2019s a good-natured, decades-long rivalry over whose jollof is best.' },
  { flag: '🇪🇹', country: 'Ethiopia', dish: 'Injera with Wat', fact: 'The spongy flatbread injera doubles as your plate and your cutlery.' },
  { flag: '🇮🇩', country: 'Indonesia', dish: 'Nasi Goreng', fact: 'Fried rice eaten for breakfast, lunch, and dinner — it\u2019s that versatile.' },
  { flag: '🇵🇭', country: 'Philippines', dish: 'Adobo', fact: 'Meat is simmered in vinegar and soy sauce — it was originally a way to preserve food.' },
  { flag: '🇱🇧', country: 'Lebanon', dish: 'Tabbouleh', fact: 'It\u2019s mostly parsley, with just a little bulgur wheat mixed in.' },
  { flag: '🇵🇪', country: 'Peru', dish: 'Ceviche', fact: 'Fresh fish "cooks" in citrus juice — no heat required at all.' },
  { flag: '🇨🇳', country: 'China', dish: 'Mapo Tofu', fact: 'Named after a slightly pockmarked ("m\u0101") grandmother ("p\u00f3") who first sold it.' },
  { flag: '🇬🇧', country: 'United Kingdom', dish: 'Sunday Roast', fact: 'Legend says it dates back to knights roasting meat before Sunday church.' },
  { flag: '🇮🇪', country: 'Ireland', dish: 'Irish Stew', fact: 'The classic version uses lamb or mutton, potatoes, and not much else.' },
  { flag: '🇸🇪', country: 'Sweden', dish: 'K\u00f6ttbullar', fact: 'Swedish meatballs are traditionally served with lingonberry jam, not ketchup.' },
  { flag: '🇺🇸', country: 'United States', dish: 'Gumbo', fact: 'This Louisiana stew blends French, African, and Native American cooking traditions.' },
];

function getTodaysNationalDish() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return NATIONAL_DISHES[dayOfYear % NATIONAL_DISHES.length];
}


function resizeImage(file, maxWidth, quality, maxChars) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const renderAt = (width, q) => {
          const scale = Math.min(1, width / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL('image/jpeg', q);
        };
        let result = renderAt(maxWidth, quality);
        // Optional byte budget (in base64 chars): the artifact sandbox's request-size
        // limit fails silently (empty 200 response) rather than with a clear error, so
        // for photos we'd rather shrink proactively than let that happen. Ease off
        // quality first, then dimensions, until we're under budget or hit a floor.
        if (maxChars) {
          let q = quality;
          let w = maxWidth;
          let attempts = 0;
          while (result.length > maxChars && attempts < 6) {
            attempts += 1;
            if (q > 0.35) {
              q = Math.max(0.35, q - 0.12);
            } else {
              w = Math.round(w * 0.75);
            }
            result = renderAt(w, q);
          }
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Re-encodes an already-resized data URL at a smaller size/quality without re-reading
// the original file. Used as a last-resort retry when a request comes back with an
// empty body, which usually means the payload was too large for the sandbox to relay.
function recompressDataUrl(dataUrl, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Posts to the Anthropic API and returns the parsed JSON body. The sandbox relay
// occasionally returns a 200 with a completely empty body — a transient hiccup, not
// a real API error, and one that shows up even for plain text requests (URL/paste
// extraction, meal-plan auto-fill) that aren't hitting any payload-size limit. Rather
// than fail the whole action, retry the request itself a couple of times with a short
// backoff before giving up. Real HTTP errors (4xx/5xx) are NOT retried — those are
// surfaced immediately.
async function postToClaudeWithRetry(body, { maxRetries = 2, retryDelayMs = 900 } = {}) {
  let lastEmptyStatus = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      const headers = await getAuthedHeaders();
      response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      if (String(networkErr?.message || '').startsWith('AUTH:')) throw networkErr;
      throw new Error(`NETWORK: ${networkErr?.name || 'Error'} — ${networkErr?.message || 'no message'}`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errText = await response.text();
        try {
          const errBody = JSON.parse(errText);
          detail = errBody?.error?.message || errText;
        } catch {
          detail = errText || `HTTP ${response.status}`;
        }
      } catch {
        detail = `HTTP ${response.status}`;
      }
      throw new Error(`API: ${detail}`);
    }

    let rawText;
    try {
      rawText = await response.text();
    } catch (readErr) {
      throw new Error(`READ: ${readErr?.name || 'Error'} — ${readErr?.message || 'could not read response body'}`);
    }

    if (rawText && rawText.length > 0) {
      try {
        return JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`PARSE: Response body was not valid JSON (length ${rawText.length}) — ${rawText.slice(0, 200)}`);
      }
    }

    lastEmptyStatus = response.status;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
    }
  }
  throw new Error(`PARSE: Response body was empty (status ${lastEmptyStatus}), even after retrying automatically a couple of times.`);
}

// ---------- quantity scaling helpers ----------
function parseServingsNumber(str) {
  if (!str) return null;
  const match = String(str).match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function toDecimal(str) {
  str = str.trim();
  if (str.includes(' ') && str.includes('/')) {
    const [intPart, fracPart] = str.split(' ');
    const [n, d] = fracPart.split('/').map(Number);
    return parseInt(intPart, 10) + n / d;
  }
  if (str.includes('/')) {
    const [n, d] = str.split('/').map(Number);
    return n / d;
  }
  return parseFloat(str);
}

function formatQuantity(value) {
  if (!isFinite(value) || value <= 0) return '0';
  const whole = Math.floor(value);
  const frac = value - whole;
  const fractionsMap = [
    [0, ''], [0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'], [0.5, '1/2'],
    [0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'], [1, ''],
  ];
  let closest = fractionsMap[0];
  let minDiff = Infinity;
  for (const pair of fractionsMap) {
    const diff = Math.abs(frac - pair[0]);
    if (diff < minDiff) { minDiff = diff; closest = pair; }
  }
  let w = whole;
  let label = closest[1];
  if (closest[0] === 1) { w += 1; label = ''; }
  if (minDiff > 0.08) {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }
  let result = '';
  if (w > 0) result += w;
  if (label) result += (w > 0 ? ' ' : '') + label;
  return result || '0';
}

// ---------- time parsing (for sort) ----------
function parseTimeMinutes(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  let total = 0;
  let found = false;
  const hourMatch = s.match(/(\d+(\.\d+)?)\s*(hours?|hrs?|h\b)/);
  if (hourMatch) { total += parseFloat(hourMatch[1]) * 60; found = true; }
  const minMatch = s.match(/(\d+(\.\d+)?)\s*(minutes?|mins?|m\b)/);
  if (minMatch) { total += parseFloat(minMatch[1]); found = true; }
  if (!found) {
    const bare = s.match(/\d+(\.\d+)?/);
    if (bare) { total = parseFloat(bare[0]); found = true; }
  }
  return found ? total : null;
}

// A recipe's weekday/weekend tag is derived live from its time, never stored — so it can
// never go stale if the time is edited later, and it just shows up as a tag everywhere.
function getTimeCategory(timeStr) {
  const mins = parseTimeMinutes(timeStr);
  if (mins == null) return null;
  return mins <= 45 ? 'weekday' : 'weekend';
}

function scaleIngredientText(text, factor) {
  if (!text || factor === 1) return text;
  const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)/);
  if (!match) return text;
  const decimal = toDecimal(match[0]);
  if (!isFinite(decimal)) return text;
  const scaled = decimal * factor;
  const formatted = formatQuantity(scaled);
  return formatted + text.slice(match[0].length);
}

// ---------- cook-mode step timer ----------
const TIME_UNIT_RE = 'hours?|hrs?|h\\b|minutes?|mins?|m\\b|seconds?|secs?|s\\b';

function unitToSeconds(num, unit) {
  if (/^h/i.test(unit)) return num * 3600;
  if (/^m/i.test(unit)) return num * 60;
  return num;
}

// Detects a duration mentioned in a step's text, including ranges like "10-15 minutes"
// and mixed-unit ranges like "30 seconds to 1 minute" or "45 min to 1 hr".
// Returns { lowerSeconds, upperSeconds } — lowerSeconds is null for a single duration.
function parseStepTimer(stepText) {
  if (!stepText) return null;
  const s = stepText.toLowerCase();

  // low number's unit is optional (falls back to the high number's unit, e.g. "10-15 minutes"),
  // but the high number's unit is required so this doesn't fire on unrelated number ranges.
  const rangeRe = new RegExp(`(\\d+)\\s*(${TIME_UNIT_RE})?\\s*(?:-|–|—|to)\\s*(\\d+)\\s*(${TIME_UNIT_RE})`, 'i');
  const rangeMatch = s.match(rangeRe);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const highUnit = rangeMatch[4];
    const lowUnit = rangeMatch[2] || highUnit;
    const high = parseInt(rangeMatch[3], 10);
    const lowerSeconds = unitToSeconds(low, lowUnit);
    const upperSeconds = unitToSeconds(high, highUnit);
    if (upperSeconds > lowerSeconds) {
      return { lowerSeconds, upperSeconds };
    }
  }

  const singleRe = new RegExp(`(\\d+)\\s*(${TIME_UNIT_RE})`, 'i');
  const singleMatch = s.match(singleRe);
  if (singleMatch) {
    const secs = unitToSeconds(parseInt(singleMatch[1], 10), singleMatch[2]);
    if (secs > 0) return { lowerSeconds: null, upperSeconds: secs };
  }

  return null;
}

function formatMMSS(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function playTimerTone(short) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = short ? 700 : 880;
    const dur = short ? 0.18 : 0.45;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
    setTimeout(() => ctx.close().catch(() => {}), (dur + 0.2) * 1000);
  } catch {
    // audio isn't critical to the timer working — ignore failures silently
  }
}

// ---------- API ----------
async function testApiConnection() {
  const headers = await getAuthedHeaders();
  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    }),
  });
  const raw = await response.text();
  return { status: response.status, ok: response.ok, raw: raw.slice(0, 500) };
}

// Appended to prompts where Claude is inventing or reconstructing a recipe rather than
// transcribing an existing one — the app is used in the UK, so recipes it authors should read
// like they were written for a UK kitchen. Deliberately NOT used in extractRecipeFromUrl/
// FromText/FromImages, which exist specifically to preserve a real source's original wording
// and units exactly as written (see those functions' prompts) — converting those would work
// against the whole point of an accurate import.
const UK_STYLE_INSTRUCTION = `Write it in UK English, for a UK kitchen: use UK terms (e.g. "mince" not "ground beef", "coriander" not "cilantro", "aubergine"/"courgette" not "eggplant"/"zucchini", "plain flour"/"self-raising flour" not "all-purpose flour", "grill" not "broil", "caster sugar" where that's the traditional choice). Use metric measurements — grams, millilitres, °C — rather than cups, ounces, or °F; convert confidently using standard reference weights for common ingredients (e.g. 1 cup plain flour ≈ 125g, 1 cup granulated sugar ≈ 200g, 1 cup butter ≈ 227g) rather than leaving things vague or mixed-unit.`;

async function extractRecipeFromUrl(url) {
  const prompt = `Fetch and read the recipe at this exact URL: ${url}

Use the web fetch tool to retrieve the actual page content directly — don't rely on search result snippets or cached summaries for the ingredient list, since those often drop exact quantities. Read the fetched page itself for the precise amounts.

Extract it into strict JSON only — no markdown fences, no preamble, no commentary, no apology, no explanation. This rule applies even if you cannot access the page: you must still respond with ONLY the JSON object below, never with prose. Read the whole recipe carefully: capture every ingredient (including small ones like salt, garnishes, or "for serving" items) and every step in order — don't summarize or skip any. Preserve ingredient quantities and units exactly as written on the page; do not round, approximate, convert, or omit them.

Return exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],
  "steps": string[],  // Break the method into short, discrete steps — one clear action per step.
  "tags": string[],  // 2-5 short lowercase tags like cuisine or meal type, e.g. "italian", "dinner", "vegetarian", "pasta"
  "imageUrl": string,  // the full absolute URL of the recipe's main hero/food photo on the page (not an icon, logo, or ad), if you can identify one — else ""
  "caveat": string,  // "" if you're confident this is accurate and complete. If you could not fetch the live page and instead reconstructed the recipe from cached, indexed, or otherwise imperfect data — so it's usable but might not match exactly, especially the quantities — say so briefly here. This does NOT mean you should leave the other fields empty; fill them in as best you can.
  "error": string  // leave as "" whenever you were able to produce a real, usable recipe (even an imperfect or reconstructed one — use "caveat" above for that). Only set this, and leave ingredients/steps empty, if you could not find or reconstruct any usable recipe at all — e.g. "The page could not be retrieved and no recipe was found" or "No recipe exists at this URL".
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    tools: [
      { type: 'web_search_20250305', name: 'web_search' },
      { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3, max_content_tokens: 30000 },
    ],
  });

  const text = (data.content || [])
    .map((b) => (b.type === 'text' ? b.text : ''))
    .filter(Boolean)
    .join('\n');
  const clean = text.replace(/```json|```/g, '').trim();

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // the model ignored the JSON-only instruction and explained the failure in prose instead —
    // treat its own explanation as the reason, rather than surfacing raw unparsed text
    const reason = clean.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`PAGEERR: ${reason || "Claude wasn't able to access that page"}`);
  }
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice.slice(0, 200)}`);
  }

  if (parsed && parsed.error && !(parsed.title || (parsed.ingredients || []).length || (parsed.steps || []).length)) {
    throw new Error(`PAGEERR: ${parsed.error}`);
  }

  return parsed;
}

function looksLikeUrl(str) {
  return /^https?:\/\/\S+$/i.test(str.trim());
}

// Recognises YouTube/TikTok/Instagram links specifically, so the paste flow can route them
// to the video-reading Cloud Function instead of the generic web-search page extraction,
// which can't actually watch or listen to a video.
function looksLikeVideoUrl(str) {
  if (!looksLikeUrl(str)) return false;
  try {
    const hostname = new URL(str.trim()).hostname.replace(/^www\./, '');
    return (
      /(^|\.)youtube\.com$/.test(hostname) ||
      hostname === 'youtu.be' ||
      /(^|\.)tiktok\.com$/.test(hostname) ||
      /(^|\.)instagram\.com$/.test(hostname)
    );
  } catch {
    return false;
  }
}

// Asks the Cloud Function to fetch a page and read its real og:image/twitter:image meta tag —
// a genuine value the page itself set, not a model's guess. Fails soft (empty string) on any
// problem, since the caller always has extractRecipeFromUrl's imageUrl guess as a fallback.
async function fetchPageImage(url) {
  try {
    const headers = await getAuthedHeaders();
    const response = await fetch(FETCH_PAGE_IMAGE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return '';
    const data = await response.json();
    return data && data.imageUrl ? data.imageUrl : '';
  } catch {
    return '';
  }
}

// Asks the Cloud Function to read a YouTube/TikTok/Instagram page server-side (CORS blocks
// this from the browser) and return whatever transcript/caption/description text it found,
// plus a thumbnail. No AI call here — this is a plain fetch-and-parse step; the resulting
// text gets sent to Claude separately via extractRecipeFromVideoText.
async function fetchVideoText(url) {
  const headers = await getAuthedHeaders();
  let response;
  try {
    response = await fetch(EXTRACT_VIDEO_TEXT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
  } catch (networkErr) {
    throw new Error(`NETWORK: ${networkErr?.name || 'Error'} — ${networkErr?.message || 'no message'}`);
  }
  if (!response.ok) {
    throw new Error(`VIDEOERR: Couldn't reach the video-reading service (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (data.error && !data.text) {
    throw new Error(`VIDEOERR: ${data.error}`);
  }
  return data;
}

// Turns the transcript/caption/description text fetchVideoText found into a recipe — same
// JSON-extraction pattern as extractRecipeFromText, but the prompt expects spoken or
// caption-style text rather than a formatted recipe page, and is explicit that quantities
// mentioned in speech or captions may be approximate or missing.
async function extractRecipeFromVideoText(platform, title, text) {
  const sourceLabel =
    platform === 'youtube' ? "a YouTube video's transcript and description" :
    platform === 'tiktok' ? "a TikTok video's caption" :
    "an Instagram video's caption";

  const prompt = `The text below was pulled from ${sourceLabel}${title ? ` titled "${title}"` : ''}. It may be conversational, informally worded, or missing precise quantities — reconstruct the best genuine, practical recipe you can from it, using standard technique and typical quantities to fill any real gaps rather than leaving things vague. ${UK_STYLE_INSTRUCTION} Extract into strict JSON only — no markdown fences, no preamble, no commentary.

Return exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],
  "steps": string[],  // Break the method into short, discrete steps — one clear action per step.
  "tags": string[],  // 2-5 short lowercase tags like cuisine or meal type
  "error": string  // leave as "" if you could reconstruct a usable recipe. Only set this, and leave ingredients/steps empty, if the text has nothing to do with food or cooking at all.
}

Text:
"""
${text.slice(0, 12000)}
"""`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = responseText.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice.slice(0, 200)}`);
  }
  if (parsed && parsed.error && !(parsed.title || (parsed.ingredients || []).length || (parsed.steps || []).length)) {
    throw new Error(`VIDEOERR: ${parsed.error}`);
  }
  return parsed;
}

// Writes a method for a recipe that has ingredients but no instructions yet — same
// JSON-extraction pattern as the other generation helpers.
async function generateStepsForRecipe(title, ingredients, servings, time) {
  const prompt = `Write clear, complete cooking steps for this recipe, based on its title and ingredient list. Be practical and specific — reference the actual ingredients and quantities from the list where it's relevant to do so, and break the method into short, discrete steps (one clear action per step), the way a good recipe would. Write in UK English and use UK cooking terms (e.g. "grill" not "broil") and °C for any temperatures you mention — but where the ingredient list below already uses a particular term for something (e.g. "ground beef"), refer to it that way in the steps too rather than switching terminology mid-recipe.

Title: ${title}
${servings ? `Servings: ${servings}\n` : ''}${time ? `Total time: ${time}\n` : ''}Ingredients:
${(ingredients || []).map((i) => `- ${i}`).join('\n')}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "steps": string[]
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  try {
    return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message}`);
  }
}

// Reconciles the steps with the ingredient list after the ingredients have been edited —
// e.g. someone swaps "tomato ketchup" for "bbq sauce" in the ingredients but the steps still
// say "spread the ketchup over...". Editing free-text fields independently means nothing keeps
// them in sync automatically, so this is an explicit action rather than something that runs on
// every edit. Deliberately scoped to fixing inconsistencies only — same steps, same order, same
// level of detail — not a general rewrite.
async function syncStepsWithIngredients(ingredientsArr, stepsArr) {
  const prompt = `Here is a recipe's ingredient list and its current method steps. The ingredients may have been edited since the steps were written, so a step might still refer to an ingredient by an old name, form, or quantity it no longer has (e.g. the ingredient list now says "barbecue sauce" but a step still says "ketchup"). Update the wording in the steps so they're fully consistent with the current ingredient list below — fix any leftover references to ingredients that were changed, renamed, or removed — but otherwise leave the steps exactly as they are: same steps, same order, same actions, same level of detail. Don't rewrite anything that isn't actually inconsistent with the ingredients.

Ingredients:
${ingredientsArr.map((i) => `- ${i}`).join('\n')}

Current steps:
${stepsArr.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "steps": string[]  // same number and order of steps as above, wording updated only where it was inconsistent with the ingredients
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message}`);
  }
  return parsed.steps || [];
}

// Looks up a real, verified photo on Wikimedia Commons for a dish name. Unlike asking
// Claude to guess a URL from web search snippets, this confirms the file actually exists
// (and is a real image, not an SVG logo/icon) before we ever try to use it. Free, no key,
// CORS-enabled via origin=*. Scores results by how well the dish's own words match the
// filename, since Commons' own relevance ranking can surface a topically-related but wrong
// dish (e.g. a different coconut-based dish for "Thai Coconut Jasmine Rice"). Returns a
// direct image URL, or null if nothing sufficiently matches.
const TITLE_STOPWORDS = new Set(['and', 'with', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'from', 'style', 'recipe', 'dish']);
function significantWords(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TITLE_STOPWORDS.has(w));
}
async function findImageOnWikimedia(title, tags) {
  // Pass 1: title alone. For well-known dishes, Commons files are often titled almost exactly
  // like this (e.g. a real file called "Grilled cheese sandwich.jpg" exists) — adding the
  // app's own recipe tags (like "quick" or "vegetarian") into the search only dilutes this
  // exact-match case with irrelevant keywords.
  const precise = await searchWikimediaCommons(title, `${title} food`);
  if (precise) return precise;

  // Pass 2: broader query with up to 2 tags, for less common or ambiguous dish names where
  // extra context might actually help Commons' search surface something relevant.
  if (tags && tags.length) {
    const broad = await searchWikimediaCommons(title, `${title} ${tags.slice(0, 2).join(' ')} food`);
    if (broad) return broad;
  }
  return null;
}

async function searchWikimediaCommons(title, searchQuery) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data && data.query && data.query.pages;
    if (!pages) return null;

    const titleWords = significantWords(title);
    if (titleWords.length === 0) return null;

    let best = null;
    let bestScore = 0;
    for (const page of Object.values(pages)) {
      const info = page.imageinfo && page.imageinfo[0];
      if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
      const fileWords = new Set(significantWords(page.title));
      const matches = titleWords.filter((w) => fileWords.has(w)).length;
      const score = matches / titleWords.length;
      if (score > bestScore) {
        bestScore = score;
        best = info;
      }
    }
    // Require at least half of the dish's significant words to show up in the filename —
    // otherwise it's a coincidental topical match rather than a genuine one, so we let the
    // Claude web-search fallback take a shot instead of returning a confidently wrong photo.
    if (!best || bestScore < 0.5) return null;
    return best.thumburl || best.url;
  } catch {
    return null;
  }
}

// Finds a real photo for a recipe that doesn't have one yet. Tries Wikimedia Commons first
// (fast, free, and verified to actually exist). If nothing matches well there, asks Claude to
// find a genuine recipe page for the dish (a much more reliable search task than asking it to
// guess a raw image URL directly), then reads that page's real og:image tag via the same
// deterministic fetchPageImage lookup used for URL import — rather than asking Claude to guess
// an image URL from search snippets, which is what made this feature unreliable before.
async function findRecipePhoto(title, tags) {
  const wikimediaUrl = await findImageOnWikimedia(title, tags);
  console.log('findRecipePhoto: Wikimedia result:', wikimediaUrl || '(none)');
  if (wikimediaUrl) {
    return { imageUrl: wikimediaUrl };
  }

  const pageUrl = await findRecipePageUrl(title, tags);
  console.log('findRecipePhoto: candidate page:', pageUrl || '(none)');
  if (pageUrl) {
    const pageImageUrl = await fetchPageImage(pageUrl);
    console.log('findRecipePhoto: og:image from that page:', pageImageUrl || '(none)');
    if (pageImageUrl) return { imageUrl: pageImageUrl };
  }

  // No further fallback here on purpose — asking Claude to guess a raw image URL directly
  // (rather than reading a real page's real og:image, as above) was tested and found to
  // hallucinate plausible-looking but nonexistent URLs, which is worse than honestly
  // reporting no photo was found.
  return { imageUrl: '' };
}

// Asks Claude to find a genuine recipe/food page for this dish — a normal web search task,
// not asking it to infer a raw image URL. Returns a page URL, or '' if nothing suitable found.
async function findRecipePageUrl(title, tags) {
  const prompt = `Find a real, currently-live web page with a genuine recipe or article about the dish "${title}"${tags && tags.length ? ` (cuisine/style hints: ${tags.join(', ')})` : ''}. Search the web for this. Prefer major recipe sites (BBC Good Food, Wikipedia, Wikimedia Commons, well-known food blogs) over obscure or low-quality sites.

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "pageUrl": string  // a real, absolute URL to a page about this dish, or "" if you couldn't find one
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });

  const text = (data.content || [])
    .map((b) => (b.type === 'text' ? b.text : ''))
    .filter(Boolean)
    .join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return '';
  try {
    const parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
    return (parsed && parsed.pageUrl) || '';
  } catch {
    return '';
  }
}

async function extractRecipeFromText(rawText) {
  const prompt = `You are reading recipe text copied from a website. Extract the recipe into strict JSON only — no markdown fences, no preamble, no commentary. If a field isn't present, use a sensible empty value. Ignore ads, navigation text, comments, and unrelated site content if present. Capture every ingredient (including small ones like salt, garnishes, or "for serving" items) and every step in order — don't summarize or skip any. Preserve ingredient quantities and units exactly as written; do not round, approximate, or convert them.

Return exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],
  "steps": string[],  // Break the method into short, discrete steps — one clear action per step.
  "tags": string[]  // 2-5 short lowercase tags like cuisine or meal type, e.g. "italian", "dinner", "vegetarian", "pasta"
}

Recipe text:
"""
${rawText.slice(0, 12000)}
"""`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = data.content.map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice.slice(0, 200)}`);
  }
}

// Turns the "World Kitchen" spotlight dish (just a name + a fun fact, no ingredients or
// method) into an actual full recipe, using the same JSON-extraction pattern as the
// photo/URL/paste flows so it can drop straight into the same review screen.
async function generateRecipeForDish(dish) {
  const prompt = `Write an authentic, home-cook-friendly recipe for "${dish.dish}" from ${dish.country}. This should be a genuine, complete recipe a home cook could actually follow — proper quantities and clear steps — not a simplified summary. ${UK_STYLE_INSTRUCTION} Return strict JSON only — no markdown fences, no preamble, no commentary.

Return exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],  // include realistic quantities and units
  "steps": string[],  // Break the method into short, discrete steps — one clear action per step.
  "tags": string[]  // 2-5 short lowercase tags — include the cuisine (e.g. "${dish.country.toLowerCase()}") and a meal-type tag
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = data.content.map((b) => b.text || '').join('\n');
  const clean2 = text.replace(/```json|```/g, '').trim();
  const firstBrace2 = clean2.indexOf('{');
  const lastBrace2 = clean2.lastIndexOf('}');
  if (firstBrace2 === -1 || lastBrace2 === -1 || lastBrace2 <= firstBrace2) {
    throw new Error(`PARSE: No JSON object found in response: ${clean2.slice(0, 200)}`);
  }
  const jsonSlice2 = clean2.slice(firstBrace2, lastBrace2 + 1);
  try {
    return JSON.parse(jsonSlice2);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice2.slice(0, 200)}`);
  }
}

async function analyzeNoteForChanges(note, ingredients, steps) {
  const prompt = `A user just saved a note on a recipe after cooking it. Decide whether the note implies a concrete, specific change to a particular ingredient or a particular step's text. This includes:
- an amount/quantity change ("more garlic", "add 5 more minutes in the oven")
- a technique or timing change ("needed to boil longer", "too salty")
- an ingredient substitution or rename ("use mince beef instead of ground beef", "swap the ketchup for bbq sauce", "I used turkey instead of chicken")

For a substitution/rename, check BOTH the ingredients list and the steps for every line that mentions the old ingredient — if the same ingredient is named in a step as well as its own ingredient line, suggest a change for each affected line, not just the ingredient line.

Do NOT suggest anything for vague, subjective, or purely positive/negative notes that don't specify what to change ("loved it", "kids didn't like it", "will make again").

Current ingredients (0-indexed):
${ingredients.map((ing, i) => `${i}: ${ing}`).join('\n') || '(none)'}

Current steps (0-indexed):
${steps.map((s, i) => `${i}: ${s}`).join('\n') || '(none)'}

User's note: "${note}"

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "suggestions": [
    {
      "type": "ingredient",
      "index": number,
      "current": string,
      "suggested": string,
      "reason": string
    }
  ]
}
Rules: only include an entry for a line that actually needs to change because of what the note says. "suggested" must be the full replacement line, written in the same format/style as "current" (same units, same sentence structure), just adjusted — for a substitution, replace the specific ingredient mention but leave the rest of the line's wording alone. "reason" is one short clause explaining why, referencing the note. If nothing concrete is implied, return {"suggestions": []}. Prefer zero suggestions over a speculative one, but don't skip a real, clearly-implied change just because it's a substitution rather than a quantity.`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
  const parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
}

// Same suggestion shape and review UI as analyzeNoteForChanges (ingredient/step diffs the user
// applies individually, not a silent rewrite) — just driven by a chosen diet instead of a
// free-text note. Also checks the steps for mentions of a substituted ingredient, same as the
// substitution case in analyzeNoteForChanges, so "swap the butter for oil" doesn't leave a step
// still saying "melt the butter".
async function analyzeDietarySwap(dietType, ingredients, steps) {
  const prompt = `Adapt this recipe to be ${dietType}. For every ingredient that conflicts with a ${dietType} diet, suggest a specific, sensible substitute that keeps the dish working — similar role, texture, and flavour where possible — rather than just removing it. For every step that names an ingredient you're substituting, suggest updated step wording so the method still makes sense with the substitute in place. Don't suggest anything for ingredients or steps that are already ${dietType}-safe.

Current ingredients (0-indexed):
${ingredients.map((ing, i) => `${i}: ${ing}`).join('\n') || '(none)'}

Current steps (0-indexed):
${steps.map((s, i) => `${i}: ${s}`).join('\n') || '(none)'}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "suggestions": [
    {
      "type": "ingredient",
      "index": number,
      "current": string,
      "suggested": string,
      "reason": string
    }
  ]
}
Rules: only include a line that actually needs to change to be ${dietType}. "suggested" must be the full replacement line, written in the same format/style as "current" (same units, same sentence structure). "reason" is one short clause naming what made the original non-${dietType} and what it's swapped for. If the recipe is already fully ${dietType} as written, return {"suggestions": []}.`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace2 = clean.indexOf('{');
  const lastBrace2 = clean.lastIndexOf('}');
  if (firstBrace2 === -1 || lastBrace2 === -1) throw new Error('No JSON found');
  const parsed = JSON.parse(clean.slice(firstBrace2, lastBrace2 + 1));
  return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
}

// Rough, AI-estimated nutrition per serving — general knowledge of typical ingredient nutrition
// and standard serving math, not a lab analysis. The UI labels it as an estimate; this function
// deliberately doesn't try to look more precise than that (whole-number grams, calories to the
// nearest 10). Cached on the recipe (see handleEstimateNutrition) so it isn't re-run on every
// visit to the recipe — "Re-estimate" recomputes it on demand.
async function estimateRecipeNutrition(ingredients, servings) {
  const prompt = `Estimate the approximate nutrition per serving for this recipe. This is a rough, general estimate for a home cook — use typical nutrition values for common ingredients and standard serving math, not precise lab analysis.

Ingredients:
${(ingredients || []).map((i) => `- ${i}`).join('\n')}

Servings: ${servings || 'not specified — assume a normal single serving for this type of dish'}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace3 = clean.indexOf('{');
  const lastBrace3 = clean.lastIndexOf('}');
  if (firstBrace3 === -1 || lastBrace3 === -1) throw new Error('No JSON found');
  return JSON.parse(clean.slice(firstBrace3, lastBrace3 + 1));
}

// Combines several recipes into a single, time-optimized cooking sequence, so the person can
// cook a whole meal from one running list of steps instead of flipping between recipes and
// guessing when to start each one. Each merged step is tagged with which dish it belongs to
// (e.g. "[Rice] ...") so Cook Mode's plain step-text rendering shows it with no UI changes needed,
// and any cook/rest/wait durations are kept as explicit "X minutes"-style phrasing so the existing
// step-timer parser (parseStepTimer) keeps working on the merged steps exactly like it does today.
async function mergeStepsForMeal(recipes) {
  const listing = recipes
    .map((r, i) => `Recipe ${i + 1}: "${r.title}"${r.servings ? ` (serves ${r.servings})` : ''}\nIngredients:\n${(r.ingredients || []).map((ing) => `- ${ing}`).join('\n') || '(none listed)'}\nSteps:\n${(r.steps || []).map((s, si) => `${si + 1}. ${s}`).join('\n') || '(none listed)'}`)
    .join('\n\n');

  const prompt = `A home cook wants to make all of these dishes as one meal, at the same time, without switching back and forth between separate recipes. Merge their steps into a single ordered cooking sequence that gets everything ready and hot at roughly the same time, and also consolidate their ingredient lists into one shopping-ready list.

${listing}

For the steps: interleave them sensibly — start whatever takes longest first, use waiting/cooking/resting time in one dish to do active prep on another, and group truly simultaneous quick actions together rather than listing them one dish at a time. Combine genuinely identical shared actions (e.g. both recipes needing the oven preheated to the same temperature) into a single step rather than repeating it. Every original step's content must still be covered somewhere in the sequence — don't drop steps, just reorder and interleave them. Each merged step's text must start with the dish name in square brackets, e.g. "[Sticky Rice] Rinse the rice..." — if a step genuinely serves two dishes at once (e.g. a shared oven preheat), tag it with both names like "[Rice + Curry]". Keep any cook/rest/wait durations from the original steps written out explicitly with a number and unit (e.g. "simmer for 12 minutes", "rest for 5 mins", "bake for 25 minutes") exactly as such phrasing — this is important, don't paraphrase a time away or drop it. Keep each step concise and actionable, one clear action per step, in UK English.

For the ingredients: combine all the recipes' ingredient lists into one consolidated list. When the same ingredient appears in more than one recipe, sum the quantities into one line, e.g. "1 garlic clove" + "2 garlic cloves" becomes "3 garlic cloves". Only merge items that are clearly the same ingredient with matching or directly convertible units; if the match is unclear or the units aren't compatible, keep them as separate lines rather than guessing. Ingredients with no quantity (e.g. "salt to taste") should appear only once even if repeated. Keep the wording natural, concise, and in a similar style to the originals.

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "mealTitle": string,  // short combined name, e.g. "Sticky Rice with Thai Green Curry"
  "steps": string[],
  "ingredients": string[]
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 3500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
  const parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [];
  if (steps.length === 0) throw new Error('No merged steps were returned');
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients.filter(Boolean) : recipes.flatMap((r) => r.ingredients || []);
  return { mealTitle: parsed.mealTitle || recipes.map((r) => r.title).join(' + '), steps, ingredients };
}


async function mergeIngredientsForShoppingList(groups) {
  const listing = groups
    .map((g) => `${g.recipeTitle}:\n${(g.ingredients || []).map((i) => `- ${i}`).join('\n')}`)
    .join('\n\n');

  const prompt = `Here are ingredient lists from recipes chosen for a weekly meal plan (a recipe may appear more than once if it's planned for multiple days). Combine them into a single consolidated shopping list: when the same ingredient appears more than once — whether from one recipe used twice or from different recipes — sum the quantities into one line, e.g. "1 garlic clove" + "2 garlic cloves" becomes "3 garlic cloves". Only merge items that are clearly the same ingredient with matching or directly convertible units; if the match is unclear or the units aren't compatible, keep them as separate lines rather than guessing. Ingredients with no quantity (e.g. "salt to taste") should appear only once even if repeated. Keep the wording natural, concise, and in a similar style to the originals.

${listing}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "items": [ { "text": string } ]
}`;

  const data = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
  const parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items.map((it) => (typeof it === 'string' ? it : it.text)).filter(Boolean);
}

async function suggestPlanForEmptyDays(mealPlan, availableRecipes, recentPurchases) {
  const filledLines = mealPlan
    .filter((d) => d.recipeId)
    .map((d) => {
      const r = availableRecipes.find((x) => x.id === d.recipeId);
      if (!r) return `${d.day}: (already planned)`;
      return `${d.day}: ${r.title} — ingredients: ${(r.ingredientsPreview || []).join(', ') || '(none listed)'}`;
    });

  const emptyDays = mealPlan.filter((d) => !d.recipeId).map((d) => d.day);

  const recipeLines = availableRecipes.map((r) => {
    const cat = getTimeCategory(r.time);
    const seasonal = getSeasonalMatches(r.ingredientsPreview || []);
    const seasonTag = seasonal.inSeason.length ? ` | in-season: ${seasonal.inSeason.join(', ')}` : '';
    return `- id: ${r.id} | title: ${r.title} | ${cat ? cat : 'pace unknown'} | ingredients: ${(r.ingredientsPreview || []).join(', ') || '(none listed)'}${seasonTag}`;
  }).join('\n');

  const recentText = (recentPurchases || []).map((p) => p.text).filter(Boolean).join(', ');

  const prompt = `You are helping fill in the empty evening-meal slots in a home cook's weekly meal plan, choosing from their own existing recipe collection.

Days already planned:
${filledLines.length ? filledLines.join('\n') : '(none yet)'}

Empty days that need a recipe assigned:
${emptyDays.join(', ')}

Available recipes to choose from — you must only use recipes from this list, never invent one:
${recipeLines}
${recentText ? `\nThings bought recently (within the last ~10 days) that may well still be sitting in the fridge or cupboard: ${recentText}. If a recipe happens to use one of these, that's a nice little bonus (less waste, less to rebuy) — but only as a mild tiebreaker, never at the expense of a better overall fit.\n` : ''}
Choose one recipe for each empty day, using this rough priority order:
1. It's nice, but not essential, if the chosen recipes share ingredients with each other and with the already-planned days, to make the eventual shopping list a bit leaner — don't force an awkward fit purely to save on ingredients.
2. Avoid repeating the same recipe across multiple days unless there genuinely aren't enough distinct recipes available.
3. If a recipe's pace is known, quicker ("weekday") recipes suit weekdays a little better and longer ("weekend") ones suit weekends — treat this as a mild preference, not a rule.
4. Where a recipe is tagged "in-season" for one of its ingredients, that's a small plus (likely cheaper and easier to find right now) — again, a mild nudge, never a hard rule.
Use good judgement — this is a real family's dinner plan, not a puzzle to solve at the expense of common sense or variety.

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "assignments": [ { "day": string, "recipeId": string } ]
}
Include exactly one entry for each empty day listed above, using only recipe ids from the list provided.`;

  const data2 = await postToClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text2 = (data2.content || []).map((b) => b.text || '').join('\n');
  const clean2 = text2.replace(/```json|```/g, '').trim();
  const firstBrace2 = clean2.indexOf('{');
  const lastBrace2 = clean2.lastIndexOf('}');
  if (firstBrace2 === -1 || lastBrace2 === -1) throw new Error('No JSON found');
  const parsed2 = JSON.parse(clean2.slice(firstBrace2, lastBrace2 + 1));
  return Array.isArray(parsed2.assignments) ? parsed2.assignments : [];
}

async function extractRecipeFromImages(base64DataUrls) {
  const prompt = `You are reading ${base64DataUrls.length > 1 ? 'photos of the same recipe (e.g. ingredients on one page, method on another) — combine them into a single recipe' : 'a photo of a recipe'}. This may be a page torn from a magazine or cookbook, OR a screenshot of a recipe website. If it's a website screenshot, ignore ads, navigation menus, cookie banners, comments, "jump to recipe" links, related-recipe suggestions, and any other page clutter — focus only on the actual recipe title, ingredients, and method. Extract the recipe into strict JSON only — no markdown fences, no preamble, no commentary. If a field isn't visible, use a sensible empty value.

Read every part of the image(s) carefully before answering, including small print, margins, and multi-column layouts. Capture every ingredient (including small ones like salt, garnishes, or "for serving" items) — ingredient lists in magazines are often printed in two columns, so check both. Preserve ingredient quantities and units exactly as printed; do not round, approximate, guess at, or convert them — if a quantity is genuinely illegible, leave it out rather than inventing one. Capture every step in the original order; do not skip any.

Return exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],
  "steps": string[],  // Break the method into short, discrete steps — one clear action per step. If the original text has long paragraphs covering multiple actions, split them into separate steps rather than keeping them combined.
  "tags": string[]  // 2-5 short lowercase tags like cuisine or meal type, e.g. "italian", "dinner", "vegetarian", "pasta"
}`;

  const imageBlocks = base64DataUrls.map((url) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: url.split(',')[1] },
  }));

  let response;
  try {
    const headers = await getAuthedHeaders();
    response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [...imageBlocks, { type: 'text', text: prompt }],
          },
        ],
      }),
    });
  } catch (networkErr) {
    if (String(networkErr?.message || '').startsWith('AUTH:')) throw networkErr;
    throw new Error(`NETWORK: ${networkErr?.name || 'Error'} — ${networkErr?.message || 'no message'}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errText = await response.text();
      try {
        const errBody = JSON.parse(errText);
        detail = errBody?.error?.message || errText;
      } catch {
        detail = errText || `HTTP ${response.status}`;
      }
    } catch {
      detail = `HTTP ${response.status}`;
    }
    throw new Error(`API: ${detail}`);
  }

  let rawText;
  try {
    rawText = await response.text();
  } catch (readErr) {
    throw new Error(`READ: ${readErr?.name || 'Error'} — ${readErr?.message || 'could not read response body'}`);
  }

  if (!rawText || rawText.length === 0) {
    throw new Error(`PARSE: Response body was empty (status ${response.status}). This can happen if the photo(s) made the request too large — try again with a single, smaller photo.`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error(`PARSE: Response body was not valid JSON (length ${rawText.length}) — ${rawText.slice(0, 200)}`);
  }

  const text = data.content.map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonSlice);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice.slice(0, 200)}`);
  }
}

// Invents a genuine recipe from ingredients the user has on hand — either photographed
// (e.g. what's in the fridge) or typed as a list, or both. Same multimodal request
// pattern as extractRecipeFromImages, but creating a recipe rather than reading one.
async function generateRecipeFromIngredients(base64DataUrls, ingredientsText) {
  const hasImages = base64DataUrls && base64DataUrls.length > 0;
  const hasText = ingredientsText && ingredientsText.trim().length > 0;

  const prompt = `${hasImages ? `Look at the photo(s) provided and identify the food ingredients visible in them${hasText ? ', combined with this additional list the user typed' : ''}.` : 'The user has typed a list of ingredients they have available.'}${hasText ? `\n\nIngredients they typed:\n${ingredientsText.trim()}` : ''}

Using primarily these ingredients, invent a genuine, complete, practical recipe a home cook could actually follow — proper quantities and clear steps, not a vague idea. You may assume basic pantry staples are on hand (salt, pepper, oil, water, and similar) even if not listed or shown, but don't invent other significant ingredients unless truly necessary — if you do need to add something important that wasn't listed, keep it minor and sensible. It's fine not to use every single ingredient shown or listed if that makes for a better dish overall. ${UK_STYLE_INSTRUCTION}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],  // include realistic quantities and units
  "steps": string[],  // short, discrete steps — one clear action per step
  "tags": string[]  // 2-5 short lowercase tags
}`;

  const imageBlocks = hasImages
    ? base64DataUrls.map((url) => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: url.split(',')[1] },
      }))
    : [];

  let response;
  try {
    const headers = await getAuthedHeaders();
    response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: hasImages ? [...imageBlocks, { type: 'text', text: prompt }] : prompt,
          },
        ],
      }),
    });
  } catch (networkErr) {
    if (String(networkErr?.message || '').startsWith('AUTH:')) throw networkErr;
    throw new Error(`NETWORK: ${networkErr?.name || 'Error'} — ${networkErr?.message || 'no message'}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errText = await response.text();
      try {
        const errBody = JSON.parse(errText);
        detail = errBody?.error?.message || errText;
      } catch {
        detail = errText || `HTTP ${response.status}`;
      }
    } catch {
      detail = `HTTP ${response.status}`;
    }
    throw new Error(`API: ${detail}`);
  }

  let rawText;
  try {
    rawText = await response.text();
  } catch (readErr) {
    throw new Error(`READ: ${readErr?.name || 'Error'} — ${readErr?.message || 'could not read response body'}`);
  }

  if (!rawText || rawText.length === 0) {
    throw new Error(`PARSE: Response body was empty (status ${response.status}).${hasImages ? ' This can happen if the photo(s) made the request too large — try again with a single, smaller photo.' : ''}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`PARSE: Response body was not valid JSON (length ${rawText.length}) — ${rawText.slice(0, 200)}`);
  }

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`PARSE: No JSON object found in response: ${clean.slice(0, 200)}`);
  }
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice.slice(0, 200)}`);
  }
}

// Reverse-engineers a recipe from a photo of a finished, plated meal — the opposite
// direction from generateRecipeFromIngredients (raw ingredients in, not the cooked
// result). Identifies the dish, then works out a plausible way to actually make it.
// Same multimodal request pattern as the other two image-based flows.
async function generateRecipeFromMealPhoto(base64DataUrls, context) {
  const hasContext = context && context.trim().length > 0;
  const prompt = `Look at the photo(s) of this cooked, plated meal and work out what dish it is (or your best reasonable guess if it's not a well-known dish).${hasContext ? ` The user has provided this context to help identify it correctly — trust it over your own guess where they conflict, since a photo alone can be ambiguous (e.g. a coffee cake can look like a chocolate cake): "${context.trim()}"` : ''} Then write a genuine, complete, practical recipe a home cook could follow to make it — proper quantities and clear steps, not a vague idea. Base it on how the dish is actually and typically made, using what's visible in the photo (main components, garnishes, sauces, apparent cooking method) as a guide, but fill in gaps with standard technique for that dish rather than leaving anything vague. ${UK_STYLE_INSTRUCTION}

Return strict JSON only — no markdown fences, no preamble, no commentary — in exactly this shape:
{
  "title": string,
  "servings": string,
  "time": string,  // total time, in a short standardized format like "15 min", "1 hr", or "1 hr 30 min" (use "hr"/"min", not "hours"/"minutes")
  "ingredients": string[],  // include realistic quantities and units
  "steps": string[],  // short, discrete steps — one clear action per step
  "tags": string[]  // 2-5 short lowercase tags
}`;

  const imageBlocks = base64DataUrls.map((url) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: url.split(',')[1] },
  }));

  let response;
  try {
    const headers = await getAuthedHeaders();
    response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [...imageBlocks, { type: 'text', text: prompt }],
          },
        ],
      }),
    });
  } catch (networkErr) {
    if (String(networkErr?.message || '').startsWith('AUTH:')) throw networkErr;
    throw new Error(`NETWORK: ${networkErr?.name || 'Error'} — ${networkErr?.message || 'no message'}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errText = await response.text();
      try {
        const errBody = JSON.parse(errText);
        detail = errBody?.error?.message || errText;
      } catch {
        detail = errText || `HTTP ${response.status}`;
      }
    } catch {
      detail = `HTTP ${response.status}`;
    }
    throw new Error(`API: ${detail}`);
  }

  let rawText;
  try {
    rawText = await response.text();
  } catch (readErr) {
    throw new Error(`READ: ${readErr?.name || 'Error'} — ${readErr?.message || 'could not read response body'}`);
  }

  if (!rawText || rawText.length === 0) {
    throw new Error(`PARSE: Response body was empty (status ${response.status}). This can happen if the photo(s) made the request too large — try again with a single, smaller photo.`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`PARSE: Response body was not valid JSON (length ${rawText.length}) — ${rawText.slice(0, 200)}`);
  }

  const text2 = (data.content || []).map((b) => b.text || '').join('\n');
  const clean2 = text2.replace(/```json|```/g, '').trim();
  const firstBrace2 = clean2.indexOf('{');
  const lastBrace2 = clean2.lastIndexOf('}');
  if (firstBrace2 === -1 || lastBrace2 === -1 || lastBrace2 <= firstBrace2) {
    throw new Error(`PARSE: No JSON object found in response: ${clean2.slice(0, 200)}`);
  }
  const jsonSlice2 = clean2.slice(firstBrace2, lastBrace2 + 1);
  try {
    return JSON.parse(jsonSlice2);
  } catch (parseErr) {
    throw new Error(`PARSE: ${parseErr.message} — raw: ${jsonSlice2.slice(0, 200)}`);
  }
}

// ---------- small UI pieces ----------
// Recipes with an uploaded hero photo used to store that same base64 image twice — once as
// `image`, again as `images[0]` — so the gallery thumbnail strip could just skip index 0. That
// doubled the storage cost of every photo, which is enough on its own to push a single food
// photo over Firestore's 1MiB-per-document limit and make the save silently fail. `images` now
// only holds photos *beyond* the hero; this reconstructs the "extra photos" list either way, so
// recipes saved before this fix (where images[0] really is a duplicate of image) still render
// correctly without a data migration.
function getGalleryExtras(rec) {
  if (!rec || !rec.images || !rec.images.length) return [];
  return rec.images.filter((img) => img !== rec.image);
}

function getPlaceholder(tags) {
  const t = (tags || []).map((x) => x.toLowerCase());
  const has = (...words) => words.some((w) => t.some((tag) => tag.includes(w)));

  if (has('dessert', 'cake', 'cookie', 'sweet', 'baking', 'bake')) {
    return { Icon: Cookie, bg: '#D9A441', fg: '#2B2620' };
  }
  if (has('fish', 'seafood', 'salmon', 'shrimp', 'prawn')) {
    return { Icon: Fish, bg: '#7C97A3', fg: '#FFFDF8' };
  }
  if (has('meat', 'beef', 'chicken', 'pork', 'lamb', 'steak')) {
    return { Icon: Beef, bg: '#B8451F', fg: '#FFFDF8' };
  }
  if (has('vegetarian', 'vegan', 'salad', 'veggie', 'plant-based')) {
    return { Icon: Salad, bg: '#748B6B', fg: '#FFFDF8' };
  }
  if (has('soup', 'stew', 'broth')) {
    return { Icon: Soup, bg: '#8F3416', fg: '#FFFDF8' };
  }
  if (has('pizza')) {
    return { Icon: Pizza, bg: '#D9A441', fg: '#2B2620' };
  }
  if (has('bread', 'pastry', 'croissant')) {
    return { Icon: Croissant, bg: '#F0E6D0', fg: '#8F3416' };
  }
  if (has('breakfast', 'brunch', 'egg')) {
    return { Icon: Egg, bg: '#D9A441', fg: '#2B2620' };
  }
  if (has('drink', 'cocktail', 'beverage', 'wine')) {
    return { Icon: Wine, bg: '#8B6F8E', fg: '#FFFDF8' };
  }
  return { Icon: ChefHat, bg: '#F0E6D0', fg: '#6B6255' };
}

function Chip({ children, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: active ? COLORS.cream : COLORS.sage,
        background: active ? COLORS.sage : 'transparent',
        border: `1px solid ${COLORS.sage}`,
        padding: '3px 9px',
        borderRadius: '3px',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// Generic confirmation overlay for destructive or notable actions (delete, clear, import).
// Rendered once at the app root and driven by a single `confirmDialog` state object so any
// handler can trigger it without its own modal plumbing.
function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(43,38,32,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.cream, borderRadius: '6px', padding: '20px', width: '100%', maxWidth: '340px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}
      >
        <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '17px', color: COLORS.ink, margin: '0 0 8px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13.5px', color: COLORS.inkFaint, lineHeight: 1.5, margin: '0 0 18px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint,
              borderRadius: '3px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: danger ? COLORS.rust : COLORS.sage, color: COLORS.cream, border: 'none',
              borderRadius: '3px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Full-screen viewer for a recipe's photo(s) — tap the hero image or any secondary thumbnail
// to open it here at full size. Supports left/right arrows, tap-zones, and touch swipe when
// there's more than one photo.
function PhotoLightbox({ images, index, onIndexChange, onClose }) {
  const touchStartX = useRef(null);

  function goTo(delta) {
    const next = index + delta;
    if (next >= 0 && next < images.length) onIndexChange(next);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) goTo(-1);
    else goTo(1);
  }

  return (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,17,13,0.94)', zIndex: 110,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <button
        onClick={onClose}
        title="Close"
        style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: COLORS.cream, cursor: 'pointer', padding: '6px' }}
      >
        <X size={26} />
      </button>

      {images.length > 1 && (
        <span style={{ position: 'absolute', top: '22px', left: '20px', color: COLORS.cream, opacity: 0.7, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          {index + 1} of {images.length}
        </span>
      )}

      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
      />

      {images.length > 1 && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); goTo(-1); }}
            disabled={index === 0}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'none', color: COLORS.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo(1); }}
            disabled={index === images.length - 1}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'none', color: COLORS.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: index === images.length - 1 ? 'default' : 'pointer', opacity: index === images.length - 1 ? 0.3 : 1 }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

// Auto-derived weekday/weekend indicator — styled as a solid chip to read as automatic,
// distinct from the outlined, user-entered tags.
function TimeTag({ category }) {
  if (!category) return null;
  const isWeekday = category === 'weekday';
  return (
    <span
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: COLORS.cream,
        background: isWeekday ? COLORS.sage : COLORS.mustard,
        padding: '3px 9px',
        borderRadius: '3px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {isWeekday ? 'Weekday' : 'Weekend'}
    </span>
  );
}

function MiniStars({ rating }) {
  if (!rating) return null;
  return (
    <div style={{ display: 'flex', gap: '1px', marginBottom: '5px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={11}
          fill={n <= rating ? COLORS.mustard : 'none'}
          color={n <= rating ? COLORS.mustard : COLORS.cardBorder}
          strokeWidth={1.75}
        />
      ))}
    </div>
  );
}

function StarRatingInput({ rating, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(rating === n ? 0 : n)}
          title={`Rate ${n} star${n > 1 ? 's' : ''}`}
          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', lineHeight: 0 }}
        >
          <Star
            size={24}
            fill={n <= (rating || 0) ? COLORS.mustard : 'none'}
            color={n <= (rating || 0) ? COLORS.mustard : COLORS.cardBorder}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function CookIngredientChip({ text }) {
  const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*/);
  const qty = match ? match[0].trim() : null;
  const rest = match ? text.slice(match[0].length) : text;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'baseline', gap: '6px', fontFamily: 'JetBrains Mono, monospace',
        fontSize: '13.5px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
        color: COLORS.cream, padding: '8px 12px', borderRadius: '6px', borderLeft: `2px solid ${COLORS.mustard}`,
      }}
    >
      {qty && <span style={{ color: COLORS.mustard, fontWeight: 700, flexShrink: 0 }}>{qty}</span>}
      <span>{rest}</span>
    </div>
  );
}

function RecipeCard({ entry, onClick }) {
  const placeholder = getPlaceholder(entry.tags);
  const [thumbFailed, setThumbFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        background: COLORS.cream,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: '2px',
        padding: '10px',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: '2px 3px 0 rgba(43,38,32,0.08)',
        transition: 'transform 0.15s ease',
      }}
      className="hover:-translate-y-0.5"
    >
      <div style={{ position: 'relative', marginBottom: '10px', transform: 'rotate(-0.6deg)' }}>
        {entry.thumbnail && !thumbFailed ? (
          <img
            src={entry.thumbnail}
            alt={entry.title}
            onError={() => setThumbFailed(true)}
            style={{
              width: '100%', height: '128px', objectFit: 'cover',
              border: `6px solid ${COLORS.cream}`, boxShadow: '0 1px 4px rgba(0,0,0,0.25)', display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '128px', background: placeholder.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: placeholder.fg,
          }}>
            <placeholder.Icon size={34} />
          </div>
        )}
        <div style={{
          position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%) rotate(2deg)',
          width: '26px', height: '14px', background: 'rgba(201,138,44,0.55)',
        }} />
      </div>
      <div style={{
        fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '16px', color: COLORS.ink,
        lineHeight: 1.2, marginBottom: '6px',
      }}>
        {entry.title || 'Untitled recipe'}
      </div>
      <MiniStars rating={entry.rating} />
      {entry.time && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, fontSize: '11px', marginBottom: '6px' }}>
          <Clock size={11} /> {entry.time}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        <TimeTag category={getTimeCategory(entry.time)} />
        {(entry.tags || []).slice(0, 2).map((t, i) => <Chip key={i}>{t}</Chip>)}
      </div>
    </button>
  );
}

function DetailHeroImage({ src, alt, tags, onFindPhoto, finding, onLoadError, onOpenGallery }) {
  const [failed, setFailed] = useState(false);
  const placeholder = getPlaceholder(tags);
  if (!src || failed) {
    return (
      <div style={{
        width: '100%', minHeight: '120px', borderRadius: '3px', marginBottom: '8px', background: placeholder.bg,
        color: placeholder.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '18px 0',
      }}>
        <placeholder.Icon size={44} />
        {onFindPhoto && (
          <button
            onClick={finding ? undefined : onFindPhoto}
            aria-disabled={finding}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
              border: `1px solid ${placeholder.fg}`, color: placeholder.fg, borderRadius: '3px',
              padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: finding ? 'default' : 'pointer', opacity: finding ? 0.75 : 1,
              pointerEvents: finding ? 'none' : 'auto',
            }}
          >
            {finding ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {finding ? 'Searching…' : 'Find a photo online'}
          </button>
        )}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onClick={onOpenGallery}
      onError={() => { setFailed(true); if (onLoadError) onLoadError(); }}
      style={{ width: '100%', borderRadius: '3px', marginBottom: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: onOpenGallery ? 'pointer' : 'default' }}
    />
  );
}

function FetchedImagePreview({ url, onRemove, onError }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '220px' }}>
      <img
        src={url}
        alt=""
        onError={() => { setFailed(true); if (onError) onError(); }}
        style={{ width: '100%', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'block' }}
      />
      <button
        onClick={onRemove}
        title="Remove this photo"
        style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.inkFaint, marginBottom: '4px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    width: '100%', boxSizing: 'border-box', background: COLORS.paper,
    border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px', padding: '9px 10px',
    fontFamily: 'Inter, sans-serif', fontSize: '14px', color: COLORS.ink, outline: 'none',
  };
}

function sectionHeader() {
  return {
    fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '15px', color: COLORS.rustDark,
    margin: '0 0 8px', borderBottom: `1px solid ${COLORS.cardBorder}`, paddingBottom: '4px',
  };
}

// Reads an image file and re-encodes it as a resized, compressed JPEG data URL — small
// enough to store directly on the recipe document (no separate storage bucket needed) while
// keeping typical phone photos well under Firestore's 1MB-per-document limit.
function readAndCompressImage(file, maxDim = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file doesn\'t look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function RecipeFormFields({ form, setForm, image, onImageChange }) {
  const photoInputRef = React.useRef(null);
  const [photoError, setPhotoError] = React.useState('');
  const [syncingSteps, setSyncingSteps] = React.useState(false);
  const [syncStepsError, setSyncStepsError] = React.useState('');

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const dataUrl = await readAndCompressImage(file);
      onImageChange(dataUrl);
    } catch (err) {
      setPhotoError(err?.message || 'Could not use that photo.');
    }
  }

  async function handleSyncSteps() {
    const ingredientsArr = form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    const stepsArr = form.steps.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!ingredientsArr.length || !stepsArr.length) return;
    setSyncingSteps(true);
    setSyncStepsError('');
    try {
      const newSteps = await syncStepsWithIngredients(ingredientsArr, stepsArr);
      if (newSteps.length) setForm({ ...form, steps: newSteps.join('\n') });
    } catch {
      setSyncStepsError("Couldn't update the steps. Please try again.");
    } finally {
      setSyncingSteps(false);
    }
  }

  return (
    <>
      {onImageChange && (
        <Field label="Photo">
          {image ? (
            <div style={{ position: 'relative', marginBottom: '4px', maxWidth: '200px' }}>
              <img src={image} alt="" style={{ width: '100%', borderRadius: '4px', display: 'block' }} />
              <button
                type="button"
                onClick={() => onImageChange(null)}
                title="Remove photo"
                style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Camera size={14} /> Add a photo from your camera roll
            </button>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoPick} style={{ display: 'none' }} />
          {photoError && <p style={{ color: COLORS.rust, fontSize: '12px', margin: '6px 0 0' }}>{photoError}</p>}
        </Field>
      )}
      <Field label="Title">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle()} />
      </Field>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Field label="Servings" style={{ flex: 1 }}>
          <input value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} style={inputStyle()} />
        </Field>
        <Field label="Time" style={{ flex: 1 }}>
          <input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()} />
        </Field>
      </div>
      <Field label="Ingredients (one per line)">
        <textarea rows={6} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} style={{ ...inputStyle(), fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', resize: 'vertical' }} />
      </Field>
      <Field label="Steps (one per line)">
        <textarea rows={6} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} style={{ ...inputStyle(), resize: 'vertical' }} />
        <button
          type="button"
          onClick={handleSyncSteps}
          disabled={syncingSteps || !form.ingredients.trim() || !form.steps.trim()}
          title="Fix any step wording left over from ingredients you've since changed (e.g. a step still saying &quot;ketchup&quot; after you swapped it for bbq sauce)"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
            color: syncingSteps ? COLORS.inkFaint : COLORS.rust, fontSize: '12px', fontWeight: 600,
            fontFamily: 'Inter, sans-serif', cursor: syncingSteps ? 'default' : 'pointer', padding: '6px 0 0',
          }}
        >
          {syncingSteps ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          {syncingSteps ? 'Updating steps…' : 'Update steps to match ingredients'}
        </button>
        {syncStepsError && <p style={{ color: COLORS.rust, fontSize: '12px', margin: '4px 0 0' }}>{syncStepsError}</p>}
      </Field>
      <Field label="Tags (comma separated)">
        <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={inputStyle()} />
      </Field>
    </>
  );
}

const UNIT_STOPWORDS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg',
  'ml', 'l', 'liter', 'liters', 'litre', 'litres', 'pinch', 'clove', 'cloves', 'can', 'cans',
  'large', 'medium', 'small', 'chopped', 'diced', 'sliced', 'minced', 'fresh', 'dried',
  'ground', 'of', 'a', 'an', 'the', 'to', 'taste', 'plus', 'more', 'for', 'and', 'or', 'peeled',
  'crushed', 'grated', 'finely', 'roughly', 'optional', 'divided', 'room', 'temperature',
]);

function ingredientKeywords(ingredientText) {
  const withoutQty = ingredientText.replace(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)/, '');
  const words = withoutQty
    .toLowerCase()
    .replace(/[(),.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !UNIT_STOPWORDS.has(w));
  return words;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relevantIngredientsForStep(stepText, ingredients) {
  const lowerStep = stepText.toLowerCase();
  return ingredients.filter((ing) => {
    const keywords = ingredientKeywords(ing);
    return keywords.some((k) => new RegExp(`\\b${escapeRegex(k)}s?\\b`, 'i').test(lowerStep));
  });
}

// ---------- shopping list helpers ----------
function shoppingItemLabel(text) {
  const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*/);
  const qty = match ? match[0].trim() : null;
  const rest = match ? text.slice(match[0].length).trim() : text;
  return { qty, rest };
}

// Strips a leading quantity ("2", "1/2", "1 1/2") and, if present, the unit word right after it
// ("cups", "tbsp", "g"...), leaving just the ingredient name — supermarket search boxes generally
// match on product name and get confused by amounts.
const VULGAR_FRACTIONS = '¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';

function buildQtyRegex() {
  const f = VULGAR_FRACTIONS;
  const token = `(?:\\d+\\s*[${f}]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+\\.\\d+|\\d+|[${f}])`;
  return new RegExp(`^${token}(?:\\s*-\\s*${token})?`);
}

function stripLeadingUnit(str) {
  const unitMatch = str.match(/^([a-zA-Z]+)\.?\s+/);
  if (unitMatch && UNIT_STOPWORDS.has(unitMatch[1].toLowerCase())) {
    return str.slice(unitMatch[0].length).trim();
  }
  return str;
}

// Strips one leading quantity — either "(1½ cups)" style or a plain "375 ml" style — off the
// front of str. Returns null if nothing was stripped, so the caller knows to stop looping.
function stripOneLeadingQuantity(str) {
  const qtyRe = buildQtyRegex();

  const parenMatch = str.match(/^\(([^)]+)\)\s*/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    const innerQtyMatch = inner.match(qtyRe);
    if (innerQtyMatch) {
      const afterQty = inner.slice(innerQtyMatch[0].length).trim();
      if (!afterQty || (/^[a-zA-Z.]+$/.test(afterQty) && UNIT_STOPWORDS.has(afterQty.toLowerCase().replace(/\.$/, '')))) {
        return str.slice(parenMatch[0].length).trim();
      }
    }
  }

  const qtyMatch = str.match(qtyRe);
  if (qtyMatch) {
    const stripped = stripLeadingUnit(str.slice(qtyMatch[0].length).trim());
    return stripped;
  }

  return null;
}

function stripQuantityForSearch(text) {
  if (!text) return text;
  let rest = text.trim();
  const original = rest;

  // recipes sometimes list a plain quantity AND a parenthesized alternate right after it
  // (e.g. "375 ml (1½ cups) pineapple juice") — loop until nothing more can be stripped.
  for (let i = 0; i < 5; i++) {
    const next = stripOneLeadingQuantity(rest);
    if (next == null || next === rest) break;
    rest = next;
  }

  rest = rest.trim();
  return rest || original;
}

// ---------- main app ----------
export default function RecipeBox({ onSignOut }) {
  const [index, setIndex] = useState([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // newest | az | quickest | rating
  const [view, setView] = useState('grid'); // grid | add | detail | cook | index
  const [detail, setDetail] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(null); // index into detail.images, or null when closed
  useEffect(() => {
    setGalleryIndex(null);
  }, [detail?.id]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [findingImage, setFindingImage] = useState(false);
  const [addStage, setAddStage] = useState('capture'); // capture | extracting | review
  const [retryingSmaller, setRetryingSmaller] = useState(false);
  const [generatingDish, setGeneratingDish] = useState(false);
  const [addMode, setAddMode] = useState(null); // null (menu) | photo | paste | manual | ingredients | meal
  const [pastedText, setPastedText] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [mealPhotoContext, setMealPhotoContext] = useState('');
  const [generatingFromIngredients, setGeneratingFromIngredients] = useState(false);
  const [generatingFromMealPhoto, setGeneratingFromMealPhoto] = useState(false);
  const [extractingVideo, setExtractingVideo] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]); // [{full, thumb}]
  const [fetchedImageUrl, setFetchedImageUrl] = useState('');
  const [urlExtractHadNoImage, setUrlExtractHadNoImage] = useState(false);
  const [urlImageBlocked, setUrlImageBlocked] = useState(false);
  const [form, setForm] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importToast, setImportToast] = useState(null); // { type: 'success' | 'error', text }
  const importInputRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmLabel, danger, onConfirm }
  const fileInputRef = useRef(null);

  // detail-view-only state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [displayServings, setDisplayServings] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dietaryLoadingType, setDietaryLoadingType] = useState(null); // which diet chip triggered the current suggestionsLoading run, or null for the notes flow
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);

  // cook mode
  const [cookStepIndex, setCookStepIndex] = useState(0);
  const wakeLockRef = useRef(null);
  const [timerInfo, setTimerInfo] = useState(null); // { lowerSeconds, upperSeconds } | null
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // cook mode voice control
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef(null);
  const voiceStatusTimeoutRef = useRef(null);
  // Mirrors the latest cook-mode values in a ref so the SpeechRecognition result handler —
  // which is only re-created when voice mode toggles on/off, not on every step change — always
  // acts on current data instead of whatever was current when listening started.
  const voiceLiveRef = useRef({ steps: [], cookStepIndex: 0, timerRunning: false, timerInfo: null });
  useEffect(() => {
    voiceLiveRef.current = {
      steps: detail?.steps || [],
      cookStepIndex,
      timerRunning,
      timerInfo,
    };
  }, [detail, cookStepIndex, timerRunning, timerInfo]);

  // shopping list
  const [shoppingList, setShoppingList] = useState([]);
  const [loadingShoppingList, setLoadingShoppingList] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);

  // "Make a meal" — combine multiple recipes into one interleaved cook-mode sequence
  const [mealMode, setMealMode] = useState(false);
  const [mealSelectedIds, setMealSelectedIds] = useState([]);
  const [mealMerging, setMealMerging] = useState(false);
  const [mealError, setMealError] = useState('');
  const [isMealCook, setIsMealCook] = useState(false);

  const [newItemText, setNewItemText] = useState('');
  const [listCopied, setListCopied] = useState(false);
  const [copyFallbackText, setCopyFallbackText] = useState(null);
  // items recently checked off the shopping list (i.e. likely bought) — feeds a soft
  // "you probably still have this" nudge into meal-plan auto-fill, pruned to ~10 days
  const [recentPurchases, setRecentPurchases] = useState([]); // [{ text, checkedAt }]

  // meal planner
  const [mealPlan, setMealPlan] = useState(() => WEEK_DAYS.map((day) => ({ day, recipeId: null })));
  const [loadingMealPlan, setLoadingMealPlan] = useState(true);
  const [pickingDayIndex, setPickingDayIndex] = useState(null);
  const [plannerQuery, setPlannerQuery] = useState('');
  const [generatingPlanList, setGeneratingPlanList] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  // world kitchen spotlight (grid view)
  const [nationalDishDismissed, setNationalDishDismissed] = useState(false);
  const todaysDish = useRef(getTodaysNationalDish()).current;

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get('recipe-index', false);
        setIndex(result ? JSON.parse(result.value) : []);
      } catch {
        setIndex([]);
      } finally {
        setLoadingIndex(false);
      }
      try {
        const listResult = await window.storage.get('shopping-list', false);
        setShoppingList(listResult ? JSON.parse(listResult.value) : []);
      } catch {
        setShoppingList([]);
      } finally {
        setLoadingShoppingList(false);
      }
      try {
        const planResult = await window.storage.get('meal-plan', false);
        if (planResult) {
          const parsed = JSON.parse(planResult.value);
          if (Array.isArray(parsed) && parsed.length === WEEK_DAYS.length) setMealPlan(parsed);
        }
      } catch {
        // keep default empty plan
      } finally {
        setLoadingMealPlan(false);
      }
      try {
        const purchasesResult = await window.storage.get('recent-purchases', false);
        const parsed = purchasesResult ? JSON.parse(purchasesResult.value) : [];
        const cutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
        setRecentPurchases(Array.isArray(parsed) ? parsed.filter((p) => p && p.checkedAt > cutoff) : []);
      } catch {
        setRecentPurchases([]);
      }
    })();
  }, []);

  // detect a duration in the current cook-mode step and (re)set the timer whenever the step changes
  useEffect(() => {
    if (view !== 'cook' || !detail) return;
    const info = parseStepTimer(detail.steps[cookStepIndex] || '');
    setTimerInfo(info);
    setTimerRemaining(info ? info.upperSeconds : 0);
    setTimerRunning(false);
  }, [view, detail, cookStepIndex]);

  // countdown tick
  useEffect(() => {
    if (!timerRunning) return;
    const intervalId = setInterval(() => {
      setTimerRemaining((r) => {
        if (r <= 1) {
          setTimerRunning(false);
          playTimerTone(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          if (voiceMode) speakText("Time's up");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timerRunning]);

  // chime once when a range timer crosses from "still cooking" into "ready, up to X more"
  useEffect(() => {
    if (!timerInfo || timerInfo.lowerSeconds == null || !timerRunning) return;
    const thresholdRemaining = timerInfo.upperSeconds - timerInfo.lowerSeconds;
    if (timerRemaining === thresholdRemaining) {
      playTimerTone(true);
      if (navigator.vibrate) navigator.vibrate(150);
    }
  }, [timerRemaining, timerInfo, timerRunning]);

  function speakText(text) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function handleVoiceCommand(rawTranscript) {
    const t = (rawTranscript || '').toLowerCase().trim();
    if (!t) return;
    setVoiceStatus(`Heard: "${t}"`);
    clearTimeout(voiceStatusTimeoutRef.current);
    voiceStatusTimeoutRef.current = setTimeout(() => setVoiceStatus(''), 2500);

    const { steps, cookStepIndex: idx, timerInfo: info } = voiceLiveRef.current;

    if (info && /\b(start|begin|resume)\b/.test(t) && /\b(timer|clock)\b/.test(t)) {
      setTimerRunning(true);
    } else if (info && /\b(pause|stop)\b/.test(t) && /\b(timer|clock)\b/.test(t)) {
      setTimerRunning(false);
    } else if (info && /\b(reset|restart)\b/.test(t) && /\b(timer|clock)\b/.test(t)) {
      setTimerRemaining(info.upperSeconds);
      setTimerRunning(false);
    } else if (/\b(repeat|again|say that again|what was that)\b/.test(t)) {
      speakText(steps[idx] || '');
    } else if (/\b(done|finish|finished|exit cook|stop cooking)\b/.test(t)) {
      exitCookMode();
    } else if (/\b(back|previous|go back)\b/.test(t)) {
      setCookStepIndex((i) => Math.max(0, i - 1));
    } else if (/\b(next|forward|continue)\b/.test(t)) {
      setCookStepIndex((i) => Math.min(steps.length - 1, i + 1));
    }
  }

  // Reads the current step aloud whenever it changes, so voice mode is genuinely hands-free —
  // no need to glance at the screen to know what's next.
  useEffect(() => {
    if (view !== 'cook' || !voiceMode || !detail) return;
    speakText(detail.steps[cookStepIndex] || '');
  }, [cookStepIndex, view, voiceMode, detail]);

  // Starts/stops listening whenever voice mode or the current view changes. iOS Safari's
  // SpeechRecognition doesn't support true continuous listening (it ends after each utterance,
  // or after a period of silence), so onend restarts it automatically to simulate continuous
  // hands-free control until the person turns voice mode off or leaves Cook Mode.
  useEffect(() => {
    if (!voiceMode || view !== 'cook') {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceStatus("This browser doesn't support voice control.");
      setVoiceMode(false);
      return;
    }
    let cancelled = false;
    function startListening() {
      if (cancelled) return;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-GB';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        handleVoiceCommand(last && last[0] && last[0].transcript);
      };
      recognition.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setVoiceStatus('Microphone permission denied.');
          setVoiceMode(false);
        }
        // other errors (no-speech, aborted, network) are common and non-fatal — onend restarts
      };
      recognition.onend = () => {
        if (!cancelled) startListening();
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // ignore — usually means one is already running, which is fine
      }
    }
    startListening();
    return () => {
      cancelled = true;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [voiceMode, view]);

  const allTags = useMemo(() => {
    const set = new Set();
    index.forEach((r) => {
      (r.tags || []).forEach((t) => set.add(t));
      const cat = getTimeCategory(r.time);
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [index]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return index.filter((r) => {
      const matchesQuery = !q || (
        (r.title || '').toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (r.ingredientsPreview || []).some((ing) => ing.toLowerCase().includes(q))
      );
      const matchesTag = !selectedTag || (r.tags || []).includes(selectedTag) || getTimeCategory(r.time) === selectedTag;
      return matchesQuery && matchesTag;
    });
  }, [index, query, selectedTag]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'az') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortBy === 'quickest') {
      arr.sort((a, b) => {
        const ta = parseTimeMinutes(a.time);
        const tb = parseTimeMinutes(b.time);
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return ta - tb;
      });
    } else if (sortBy === 'rating') {
      arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return arr;
  }, [filtered, sortBy]);

  const uncheckedCount = useMemo(() => shoppingList.filter((it) => !it.checked).length, [shoppingList]);

  const groupedShoppingList = useMemo(() => {
    const groups = {};
    const order = [];
    shoppingList.forEach((item) => {
      const key = item.recipeId || '__custom__';
      if (!groups[key]) {
        groups[key] = { title: item.recipeTitle || 'Added by you', items: [] };
        order.push(key);
      }
      groups[key].items.push(item);
    });
    return order.map((key) => groups[key]);
  }, [shoppingList]);

  const groupedIndex = useMemo(() => {
    const groups = {};
    [...index]
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .forEach((r) => {
        const firstChar = (r.title || '#').trim()[0] || '#';
        const key = /[a-zA-Z]/.test(firstChar) ? firstChar.toUpperCase() : '#';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
    return groups;
  }, [index]);

  async function persistIndex(newIndex) {
    setIndex(newIndex);
    try {
      await window.storage.set('recipe-index', JSON.stringify(newIndex), false);
    } catch {
      setErrorMsg('Could not save to your library. Please try again.');
    }
  }

  async function persistShoppingList(newList) {
    setShoppingList(newList);
    try {
      await window.storage.set('shopping-list', JSON.stringify(newList), false);
    } catch {
      setErrorMsg('Could not save your shopping list. Please try again.');
    }
  }

  async function persistRecentPurchases(newList) {
    setRecentPurchases(newList);
    try {
      await window.storage.set('recent-purchases', JSON.stringify(newList), false);
    } catch {
      // non-critical — auto-fill just won't have this "probably still have it" signal this time
    }
  }

  function toggleSelectMode() {
    setSelectMode((s) => !s);
    setSelectedRecipeIds([]);
    setMealMode(false);
    setMealSelectedIds([]);
    setMealError('');
  }

  function toggleMealMode() {
    setMealMode((m) => !m);
    setMealSelectedIds([]);
    setMealError('');
    setSelectMode(false);
    setSelectedRecipeIds([]);
  }

  function toggleMealRecipeSelected(id) {
    setMealSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setMealError('');
  }

  // Entry point from an individual recipe's detail page: pre-selects that recipe and drops
  // into the grid's "make a meal" picker so the person just needs to tap the second (or third...)
  // dish to combine with, rather than starting the selection from scratch.
  function startMealFrom(id) {
    setMealMode(true);
    setMealSelectedIds([id]);
    setMealError('');
    setSelectMode(false);
    setSelectedRecipeIds([]);
    setView('grid');
  }

  function toggleRecipeSelected(id) {
    setSelectedRecipeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addSelectedToShoppingList() {
    const chosen = index.filter((r) => selectedRecipeIds.includes(r.id));
    const newItems = [];
    chosen.forEach((r) => {
      (r.ingredientsPreview || []).forEach((ing) => {
        newItems.push({ id: uid(), text: ing, checked: false, recipeId: r.id, recipeTitle: r.title || 'Untitled recipe' });
      });
    });
    await persistShoppingList([...shoppingList, ...newItems]);
    setSelectMode(false);
    setSelectedRecipeIds([]);
    setView('shopping');
  }

  async function toggleShoppingItem(id) {
    const newList = shoppingList.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it));
    await persistShoppingList(newList);
  }

  async function addCustomItem() {
    const text = newItemText.trim();
    if (!text) return;
    const newItem = { id: uid(), text, checked: false, recipeId: null, recipeTitle: null };
    await persistShoppingList([...shoppingList, newItem]);
    setNewItemText('');
  }

  async function clearCheckedItems() {
    const checkedItems = shoppingList.filter((it) => it.checked);
    if (checkedItems.length > 0) {
      const now = Date.now();
      const cutoff = now - 10 * 24 * 60 * 60 * 1000;
      const merged = [...recentPurchases];
      checkedItems.forEach((it) => {
        const clean = stripQuantityForSearch(it.text || '').trim();
        if (!clean) return;
        const key = clean.toLowerCase();
        const existingIdx = merged.findIndex((p) => p.text.toLowerCase() === key);
        if (existingIdx >= 0) merged[existingIdx] = { text: clean, checkedAt: now };
        else merged.push({ text: clean, checkedAt: now });
      });
      await persistRecentPurchases(merged.filter((p) => p.checkedAt > cutoff).slice(-40));
    }
    await persistShoppingList(shoppingList.filter((it) => !it.checked));
  }

  async function clearAllItems() {
    await persistShoppingList([]);
  }

  async function copyShoppingListToClipboard() {
    const seen = new Set();
    const lines = [];
    shoppingList
      .filter((it) => !it.checked)
      .forEach((it) => {
        const stripped = stripQuantityForSearch(it.text);
        const key = stripped.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          lines.push(stripped);
        }
      });
    const text = lines.join('\n');
    if (!text) return;

    // preferred path — modern async clipboard API
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopyFallbackText(null);
        setListCopied(true);
        setTimeout(() => setListCopied(false), 1800);
        return;
      }
    } catch {
      // fall through to legacy method below — common when running inside a sandboxed frame
    }

    // legacy fallback — works in more sandboxed contexts than the async API
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        setCopyFallbackText(null);
        setListCopied(true);
        setTimeout(() => setListCopied(false), 1800);
        return;
      }
    } catch {
      // fall through to manual fallback below
    }

    // last resort — show a selectable text box so the list is still usable even if both copy methods are blocked
    setCopyFallbackText(text);
  }

  async function persistMealPlan(newPlan) {
    setMealPlan(newPlan);
    try {
      await window.storage.set('meal-plan', JSON.stringify(newPlan), false);
    } catch {
      setErrorMsg('Could not save your meal plan. Please try again.');
    }
  }

  function openDayPicker(dayIndex) {
    setPickingDayIndex(dayIndex);
    setPlannerQuery('');
    setView('plannerPick');
  }

  async function assignRecipeToDay(recipeId) {
    if (pickingDayIndex == null) return;
    const newPlan = mealPlan.map((d, i) => (i === pickingDayIndex ? { ...d, recipeId } : d));
    await persistMealPlan(newPlan);
    setPickingDayIndex(null);
    setView('planner');
  }

  async function clearDay(dayIndex) {
    const newPlan = mealPlan.map((d, i) => (i === dayIndex ? { ...d, recipeId: null } : d));
    await persistMealPlan(newPlan);
  }

  async function autoFillEmptyDays() {
    if (autoFilling) return;
    const emptyCount = mealPlan.filter((d) => !d.recipeId).length;
    if (emptyCount === 0 || index.length === 0) return;
    setAutoFilling(true);
    setErrorMsg('');
    try {
      const assignments = await suggestPlanForEmptyDays(mealPlan, index, recentPurchases);
      const byDay = {};
      assignments.forEach((a) => {
        if (a && a.day && a.recipeId) byDay[a.day] = a.recipeId;
      });
      const newPlan = mealPlan.map((d) => {
        if (d.recipeId) return d;
        const suggestedId = byDay[d.day];
        const isValid = suggestedId && index.some((r) => r.id === suggestedId);
        return isValid ? { ...d, recipeId: suggestedId } : d;
      });
      await persistMealPlan(newPlan);
    } catch (err) {
      const msg = err?.message || '';
      setErrorMsg(`Could not auto-fill the remaining days right now (${msg || 'unknown error'}). Please try again, or fill them in manually.`);
    } finally {
      setAutoFilling(false);
    }
  }

  async function generatePlanShoppingList() {
    if (generatingPlanList) return;
    const assignedDays = mealPlan.filter((d) => d.recipeId);
    if (assignedDays.length === 0) return;
    setGeneratingPlanList(true);
    setErrorMsg('');
    try {
      const groups = assignedDays
        .map((d) => {
          const recipe = index.find((r) => r.id === d.recipeId);
          return recipe ? { recipeTitle: recipe.title || 'Untitled recipe', ingredients: recipe.ingredientsPreview || [] } : null;
        })
        .filter(Boolean);
      const mergedTexts = await mergeIngredientsForShoppingList(groups);
      const newItems = mergedTexts.map((text) => ({
        id: uid(), text, checked: false, recipeId: 'meal-plan', recipeTitle: "This week's meal plan",
      }));
      await persistShoppingList([...shoppingList, ...newItems]);
      setView('shopping');
    } catch {
      setErrorMsg("Could not combine your meal plan's ingredients right now. Please try again.");
    } finally {
      setGeneratingPlanList(false);
    }
  }

  function resetAddFlow() {
    setAddStage('capture');
    setAddMode(null);
    setPastedText('');
    setIngredientsText('');
    setPendingPhotos([]);
    setFetchedImageUrl('');
    setUrlExtractHadNoImage(false);
    setUrlImageBlocked(false);
    setForm(null);
    setErrorMsg('');
    setRetryingSmaller(false);
    setGeneratingDish(false);
    setGeneratingFromIngredients(false);
  }

  function backToAddMethodMenu() {
    setAddMode(null);
    setPastedText('');
    setIngredientsText('');
    setMealPhotoContext('');
    setPendingPhotos([]);
    setFetchedImageUrl('');
    setUrlExtractHadNoImage(false);
    setUrlImageBlocked(false);
    setErrorMsg('');
  }

  function handleStartManualEntry() {
    setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
    setAddMode('manual');
    setAddStage('review');
  }

  async function handleFileSelected(e) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    try {
      const totalAfter = pendingPhotos.length + files.length;
      // Share a fixed overall payload budget across however many photos will be in play. This
      // now needs to fit comfortably under Firestore's 1,048,576-byte hard limit per document
      // (the recipe's ingredients/steps/etc text needs headroom too), not just the old artifact
      // sandbox's request-size limit this was originally tuned for.
      const perPhotoBudget = Math.max(100000, Math.min(650000, Math.floor(850000 / totalAfter)));
      const resized = await Promise.all(
        files.map((file) =>
          Promise.all([
            resizeImage(file, 750, 0.55, perPhotoBudget),
            resizeImage(file, 260, 0.6),
          ]).then(([full, thumb]) => ({ full, thumb }))
        )
      );
      setPendingPhotos((prev) => [...prev, ...resized].slice(0, 6));
    } catch {
      setErrorMsg('Could not read one or more of those photos. Try again.');
    }
    e.target.value = '';
  }

  async function handlePasteExtract() {
    if (!pastedText.trim()) return;
    setAddStage('extracting');
    setUrlImageBlocked(false);
    const trimmed = pastedText.trim();
    const isVideo = looksLikeVideoUrl(trimmed);

    if (isVideo) {
      setExtractingVideo(true);
      try {
        const video = await fetchVideoText(trimmed);
        const extracted = await extractRecipeFromVideoText(video.platform, video.title, video.text);
        setForm({
          title: extracted.title || video.title || '',
          servings: extracted.servings || '',
          time: extracted.time || '',
          ingredients: (extracted.ingredients || []).join('\n'),
          steps: (extracted.steps || []).join('\n'),
          tags: (extracted.tags || []).join(', '),
        });
        if (video.imageUrl) setFetchedImageUrl(video.imageUrl);
        setUrlExtractHadNoImage(!video.imageUrl);
        const sourceDesc = video.platform === 'youtube' ? "video's captions/description" : "video's caption";
        setErrorMsg(`Heads up: this recipe was reconstructed from the ${sourceDesc}, not a written source — worth double-checking quantities and technique.`);
        setAddStage('review');
      } catch (err) {
        const msg = err?.message || '';
        if (msg.startsWith('VIDEOERR')) setErrorMsg(`Couldn't get a recipe from that video: ${msg.replace('VIDEOERR: ', '')}`);
        else if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
        else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
        else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
        else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
        else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
        setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
        setAddStage('review');
      } finally {
        setExtractingVideo(false);
      }
      return;
    }

    try {
      const isUrl = looksLikeUrl(pastedText);
      const [extracted, pageImageUrl] = await Promise.all([
        isUrl ? extractRecipeFromUrl(pastedText.trim()) : extractRecipeFromText(pastedText),
        isUrl ? fetchPageImage(pastedText.trim()) : Promise.resolve(''),
      ]);
      setForm({
        title: extracted.title || '',
        servings: extracted.servings || '',
        time: extracted.time || '',
        ingredients: (extracted.ingredients || []).join('\n'),
        steps: (extracted.steps || []).join('\n'),
        tags: (extracted.tags || []).join(', '),
      });
      // Prefer the real og:image tag read straight off the page over Claude's web-search
      // guess — it's deterministic and doesn't rely on the model inferring a URL, which is
      // exactly what was making some sites (e.g. BBC Good Food) come back with no image.
      const bestImageUrl = (isUrl && pageImageUrl) || (isUrl && extracted.imageUrl) || '';
      if (bestImageUrl) setFetchedImageUrl(bestImageUrl);
      setUrlExtractHadNoImage(isUrl && !bestImageUrl);
      if (isUrl && extracted.caveat) {
        setErrorMsg(`Heads up: ${extracted.caveat} Worth double-checking the details below against the original page.`);
      }
      setAddStage('review');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('PAGEERR')) setErrorMsg(`Couldn't access that page (${msg.replace('PAGEERR: ', '')}). Please open the page yourself, copy the recipe text, and paste it here instead.`);
      else if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
      else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
      else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
      else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
      else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
      setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
      setAddStage('review');
    }
  }

  // Runs an image-based API call against the current pendingPhotos, and if it comes back
  // with an empty body (almost always a sandbox request-size/timeout issue, not a real
  // API error), automatically retries with progressively smaller, lower-quality copies
  // before giving up. A single retry wasn't always enough for larger or multi-photo
  // captures, so this tries up to two shrink rounds.
  async function callWithImageShrinkRetries(apiCallFn) {
    const shrinkSteps = [{ width: 480, quality: 0.4 }, { width: 320, quality: 0.25 }];
    let currentImages = pendingPhotos.map((p) => p.full);
    let lastErr = null;
    for (let attempt = 0; attempt <= shrinkSteps.length; attempt++) {
      try {
        return await apiCallFn(currentImages);
      } catch (err) {
        lastErr = err;
        const tooLarge = (err?.message || '').startsWith('PARSE: Response body was empty');
        if (!tooLarge || currentImages.length === 0 || attempt === shrinkSteps.length) {
          if (tooLarge && attempt === shrinkSteps.length) {
            throw new Error("PARSE: Response body was empty, even after shrinking the photo(s) automatically a couple of times. Try again with just one simple, well-lit photo, or switch to typing the ingredients/recipe instead.");
          }
          throw err;
        }
        setRetryingSmaller(true);
        const { width, quality } = shrinkSteps[attempt];
        currentImages = await Promise.all(currentImages.map((url) => recompressDataUrl(url, width, quality)));
        setPendingPhotos((prev) => prev.map((p, idx) => (currentImages[idx] ? { ...p, full: currentImages[idx] } : p)));
      }
    }
    throw lastErr;
  }

  async function handleExtract() {
    if (pendingPhotos.length === 0) return;
    setAddStage('extracting');
    setRetryingSmaller(false);
    try {
      const extracted = await callWithImageShrinkRetries((imgs) => extractRecipeFromImages(imgs));
      setForm({
        title: extracted.title || '',
        servings: extracted.servings || '',
        time: extracted.time || '',
        ingredients: (extracted.ingredients || []).join('\n'),
        steps: (extracted.steps || []).join('\n'),
        tags: (extracted.tags || []).join(', '),
      });
      setAddStage('review');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
      else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
      else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
      else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
      else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
      setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
      setAddStage('review');
    } finally {
      setRetryingSmaller(false);
    }
  }

  async function handleGenerateFromIngredients() {
    if (pendingPhotos.length === 0 && !ingredientsText.trim()) return;
    setAddStage('extracting');
    setRetryingSmaller(false);
    setGeneratingFromIngredients(true);
    try {
      const extracted = await callWithImageShrinkRetries((imgs) => generateRecipeFromIngredients(imgs, ingredientsText));
      setForm({
        title: extracted.title || '',
        servings: extracted.servings || '',
        time: extracted.time || '',
        ingredients: (extracted.ingredients || []).join('\n'),
        steps: (extracted.steps || []).join('\n'),
        tags: (extracted.tags || []).join(', '),
      });
      // These were photos of raw ingredients, not the finished dish — clear them so
      // the review screen and save step don't mistake them for the recipe's photo.
      setPendingPhotos([]);
      setErrorMsg('Heads up: this recipe was invented to use the ingredients you provided, rather than extracted from a real source — a good starting point, worth double-checking quantities and technique.');
      setAddStage('review');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
      else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
      else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
      else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
      else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
      setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
      setAddStage('review');
    } finally {
      setRetryingSmaller(false);
      setGeneratingFromIngredients(false);
    }
  }

  async function handleGenerateFromMealPhoto() {
    if (pendingPhotos.length === 0) return;
    setAddStage('extracting');
    setRetryingSmaller(false);
    setGeneratingFromMealPhoto(true);
    try {
      const extracted = await callWithImageShrinkRetries((imgs) => generateRecipeFromMealPhoto(imgs, mealPhotoContext));
      setForm({
        title: extracted.title || '',
        servings: extracted.servings || '',
        time: extracted.time || '',
        ingredients: (extracted.ingredients || []).join('\n'),
        steps: (extracted.steps || []).join('\n'),
        tags: (extracted.tags || []).join(', '),
      });
      // Unlike the ingredients flow, this photo IS a genuine photo of the finished dish,
      // so keep it in pendingPhotos — it becomes the recipe's hero image on save.
      setErrorMsg('Heads up: this recipe was worked out from the photo, rather than a real source — a good starting point, worth double-checking quantities and technique.');
      setAddStage('review');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
      else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
      else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
      else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
      else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
      setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
      setAddStage('review');
    } finally {
      setRetryingSmaller(false);
      setGeneratingFromMealPhoto(false);
    }
  }

  async function handleAddNationalDish(dish) {
    resetAddFlow();
    setView('add');
    setAddStage('extracting');
    setGeneratingDish(true);
    try {
      const extracted = await generateRecipeForDish(dish);
      setForm({
        title: extracted.title || dish.dish,
        servings: extracted.servings || '',
        time: extracted.time || '',
        ingredients: (extracted.ingredients || []).join('\n'),
        steps: (extracted.steps || []).join('\n'),
        tags: (extracted.tags || []).join(', '),
      });
      setErrorMsg(`Heads up: this recipe was generated for "${dish.dish}" rather than extracted from a real source — a good starting point, but worth double-checking quantities and technique.`);
      setAddStage('review');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.startsWith('NETWORK')) setErrorMsg(`Network error: ${msg.replace('NETWORK: ', '')}`);
      else if (msg.startsWith('API')) setErrorMsg(`API error: ${msg.replace('API: ', '')}`);
      else if (msg.startsWith('READ')) setErrorMsg(`Couldn't read the API response: ${msg.replace('READ: ', '')}`);
      else if (msg.startsWith('PARSE')) setErrorMsg(`Got a response but couldn't parse it as a recipe. ${msg.replace('PARSE: ', '')}`);
      else setErrorMsg(`Something went wrong: ${msg || 'unknown error'}`);
      setForm({ title: '', servings: '', time: '', ingredients: '', steps: '', tags: '' });
      setAddStage('review');
    } finally {
      setGeneratingDish(false);
    }
  }

  // Runs the same photo lookup as the "Find a photo online" button, but automatically right
  // after a recipe is saved with no photo — so there's no separate manual step to remember.
  // Fire-and-forget: the save itself already completed and navigated away, so this just
  // enriches the recipe in place once (if) a suitable photo turns up. Re-reads from storage
  // rather than trusting anything captured in memory, since by the time this resolves the
  // user may have edited, added their own photo, or even deleted the recipe.
  async function autoFindPhotoForRecipe(id, title, tags) {
    try {
      const result = await findRecipePhoto(title, tags || []);
      if (!result || !result.imageUrl) return;
      const loads = await urlLoadsAsImage(result.imageUrl);
      if (!loads) return;

      const stored = await window.storage.get(`recipe-full:${id}`, false).catch(() => null);
      if (!stored) return; // deleted, or never actually persisted
      const current = JSON.parse(stored.value);
      if (current.image) return; // already has a photo by now — don't overwrite it

      const updated = { ...current, image: result.imageUrl };
      await window.storage.set(`recipe-full:${id}`, JSON.stringify(updated), false);

      const idxSnap = await window.storage.get('recipe-index', false).catch(() => null);
      if (idxSnap) {
        try {
          const idxArr = JSON.parse(idxSnap.value);
          const newIdxArr = idxArr.map((r) => (r.id === id ? { ...r, thumbnail: result.imageUrl } : r));
          await window.storage.set('recipe-index', JSON.stringify(newIdxArr), false);
        } catch {
          // index read/parse failed — the recipe itself is still saved with its photo above,
          // just skip the in-memory/grid refresh below rather than risk writing bad data.
          return;
        }
      }
      setIndex((prev) => prev.map((r) => (r.id === id ? { ...r, thumbnail: result.imageUrl } : r)));
      // If the user is currently looking at this exact recipe's detail screen, refresh it live.
      setDetail((prev) => (prev && prev.id === id ? { ...prev, image: result.imageUrl, images: updated.images } : prev));
    } catch (err) {
      console.warn('autoFindPhotoForRecipe failed:', err);
    }
  }

  async function handleSaveRecipe() {
    const id = uid();
    const ingredientsArr = form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    const stepsArr = form.steps.split('\n').map((s) => s.trim()).filter(Boolean);
    const tagsArr = form.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const images = pendingPhotos.map((p) => p.full);
    // no uploaded photos, but a hero image was found on the source page — use its URL directly
    // rather than a downloaded copy (the app can't fetch external image bytes from the browser)
    const mainImage = images[0] || (pendingPhotos.length === 0 ? fetchedImageUrl : null) || null;
    const thumb = pendingPhotos[0]?.thumb || (pendingPhotos.length === 0 ? fetchedImageUrl : null) || null;
    // Extra photos beyond the hero (multi-photo captures only) — deliberately NOT including
    // the hero itself here. Storing the same base64 photo twice (once as `image`, again as
    // `images[0]`) was pushing single-photo food imports over Firestore's 1MiB document limit
    // and causing the save to silently fail. See getGalleryExtras for how this reconstructs on read.
    const extraImages = images.length > 1 ? images.slice(1) : [];

    const fullData = {
      id,
      title: form.title || 'Untitled recipe',
      servings: form.servings,
      time: form.time,
      ingredients: ingredientsArr,
      steps: stepsArr,
      tags: tagsArr,
      image: mainImage,
      images: extraImages,
      notes: '',
      rating: 0,
      createdAt: Date.now(),
    };

    try {
      await window.storage.set(`recipe-full:${id}`, JSON.stringify(fullData), false);
      const newEntry = {
        id,
        title: fullData.title,
        tags: tagsArr,
        thumbnail: thumb,
        ingredientsPreview: ingredientsArr,
        time: fullData.time,
        rating: 0,
        createdAt: fullData.createdAt,
      };
      await persistIndex([newEntry, ...index]);
      // No photo came in with the import (no upload, no hero image found on the source page/
      // video) — look for one automatically now instead of leaving a placeholder until someone
      // opens the recipe and clicks "Find a photo online". Deliberately not awaited: the save
      // itself is done, so don't make the user wait on a search that might take a few seconds.
      if (!mainImage) {
        autoFindPhotoForRecipe(id, fullData.title, tagsArr);
      }
      resetAddFlow();
      setView('grid');
    } catch {
      setErrorMsg('Could not save this recipe. Please try again.');
    }
  }

  async function openDetail(id) {
    setView('detail');
    setLoadingDetail(true);
    setEditing(false);
    setNoteSaved(false);
    setSuggestions([]);
    setSuggestionsLoading(false);
    setErrorMsg('');
    try {
      const result = await window.storage.get(`recipe-full:${id}`, false);
      const parsed = result ? JSON.parse(result.value) : null;
      setDetail(parsed);
      setDisplayServings(parsed ? parseServingsNumber(parsed.servings) : null);
      setNoteDraft(parsed?.notes || '');
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDelete(id) {
    try {
      await window.storage.delete(`recipe-full:${id}`, false);
      await persistIndex(index.filter((r) => r.id !== id));
      setView('grid');
      setDetail(null);
    } catch {
      setErrorMsg('Could not delete this recipe.');
    }
  }

  function startEditing() {
    setEditForm({
      title: detail.title || '',
      servings: detail.servings || '',
      time: detail.time || '',
      ingredients: (detail.ingredients || []).join('\n'),
      steps: (detail.steps || []).join('\n'),
      tags: (detail.tags || []).join(', '),
      image: detail.image || null,
    });
    setEditing(true);
  }

  async function saveEdit() {
    const ingredientsArr = editForm.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    const stepsArr = editForm.steps.split('\n').map((s) => s.trim()).filter(Boolean);
    const tagsArr = editForm.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    const updated = {
      ...detail,
      title: editForm.title || 'Untitled recipe',
      servings: editForm.servings,
      time: editForm.time,
      ingredients: ingredientsArr,
      steps: stepsArr,
      tags: tagsArr,
      image: editForm.image || null,
    };

    try {
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      const newIndex = index.map((r) => r.id === updated.id
        ? { ...r, title: updated.title, tags: tagsArr, ingredientsPreview: ingredientsArr, time: updated.time, thumbnail: updated.image || null }
        : r);
      await persistIndex(newIndex);
      setDetail(updated);
      setDisplayServings(parseServingsNumber(updated.servings));
      setEditing(false);
    } catch {
      setErrorMsg('Could not save changes.');
    }
  }

  async function saveNote() {
    const updated = { ...detail, notes: noteDraft };
    try {
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    } catch {
      setErrorMsg('Could not save your note.');
    }
  }

  async function suggestChanges() {
    if (!noteDraft.trim()) return;
    setSuggestions([]);
    setSuggestionsLoading(true);
    setDietaryLoadingType(null);
    try {
      const raw = await analyzeNoteForChanges(noteDraft.trim(), detail.ingredients || [], detail.steps || []);
      setSuggestions(raw.map((s) => ({ id: uid(), ...s })));
    } catch {
      setErrorMsg('Could not check for suggestions right now. Please try again.');
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function runDietarySwap(dietType) {
    if (!detail || suggestionsLoading) return;
    setSuggestions([]);
    setSuggestionsLoading(true);
    setDietaryLoadingType(dietType);
    try {
      const raw = await analyzeDietarySwap(dietType, detail.ingredients || [], detail.steps || []);
      setSuggestions(raw.map((s) => ({ id: uid(), ...s })));
      if (raw.length === 0) {
        setErrorMsg(`Good news — this recipe already looks ${dietType} as written.`);
      }
    } catch {
      setErrorMsg(`Could not check ${dietType} substitutions right now. Please try again.`);
    } finally {
      setSuggestionsLoading(false);
      setDietaryLoadingType(null);
    }
  }

  async function handleEstimateNutrition() {
    if (!detail || estimatingNutrition) return;
    setEstimatingNutrition(true);
    try {
      const nutrition = await estimateRecipeNutrition(detail.ingredients || [], detail.servings);
      const updated = { ...detail, nutrition };
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
    } catch {
      setErrorMsg('Could not estimate nutrition right now. Please try again.');
    } finally {
      setEstimatingNutrition(false);
    }
  }

  async function applySuggestion(sug) {
    const updated = { ...detail };
    if (sug.type === 'ingredient' && Array.isArray(updated.ingredients) && sug.index >= 0 && sug.index < updated.ingredients.length) {
      const arr = [...updated.ingredients];
      arr[sug.index] = sug.suggested;
      updated.ingredients = arr;
    } else if (sug.type === 'step' && Array.isArray(updated.steps) && sug.index >= 0 && sug.index < updated.steps.length) {
      const arr = [...updated.steps];
      arr[sug.index] = sug.suggested;
      updated.steps = arr;
    } else {
      setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
      return;
    }
    try {
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
      if (sug.type === 'ingredient') {
        const newIndex = index.map((r) => (r.id === updated.id ? { ...r, ingredientsPreview: updated.ingredients } : r));
        await persistIndex(newIndex);
      }
      setSuggestions((prev) => prev.map((s) => (s.id === sug.id ? { ...s, applied: true } : s)));
      setTimeout(() => {
        setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
      }, 1400);
    } catch {
      setErrorMsg('Could not apply that change.');
    }
  }

  function dismissSuggestion(id) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  async function setRating(newRating) {
    const updated = { ...detail, rating: newRating };
    try {
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
      const newIndex = index.map((r) => (r.id === updated.id ? { ...r, rating: newRating } : r));
      await persistIndex(newIndex);
    } catch {
      setErrorMsg('Could not save your rating.');
    }
  }

// Confirms a URL actually loads as an image in this browser before we commit to it — many
// recipe blogs and CDNs return a 200 for the page but block hotlinking to the image itself
// (or the URL Claude guessed turns out not to exist), so we'd rather find that out now than
// after already telling the user we found one.
function urlLoadsAsImage(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
    setTimeout(() => finish(false), timeoutMs);
  });
}

async function handleFindImage() {
    if (!detail || findingImage) return;
    setFindingImage(true);
    setErrorMsg('');
    try {
      const result = await findRecipePhoto(detail.title, detail.tags || []);
      if (!result || !result.imageUrl) {
        setErrorMsg("Couldn't find a suitable photo for this one — you can always add your own from the edit screen.");
        return;
      }
      const loads = await urlLoadsAsImage(result.imageUrl);
      if (!loads) {
        console.warn('handleFindImage: image URL failed to load in-browser:', result.imageUrl);
        setErrorMsg("Found a photo, but the source wouldn't let it load here — you can always add your own from the edit screen.");
        return;
      }
      // Stored as a live external URL, the same as a hero image found during URL
      // extraction — nothing is downloaded, so it'll fall back to the placeholder
      // again if the source ever takes the image down.
      const updated = { ...detail, image: result.imageUrl };
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
      const newIndex = index.map((r) => (r.id === updated.id ? { ...r, thumbnail: result.imageUrl } : r));
      await persistIndex(newIndex);
    } catch (err) {
      console.error('handleFindImage failed:', err);
      setErrorMsg(`Could not search for a photo right now: ${err?.message || 'unknown error'}`);
    } finally {
      setFindingImage(false);
    }
  }

  async function handleGenerateSteps() {
    if (!detail || generatingSteps) return;
    setGeneratingSteps(true);
    setErrorMsg('');
    try {
      const result = await generateStepsForRecipe(detail.title, detail.ingredients || [], detail.servings, detail.time);
      const steps = Array.isArray(result?.steps) ? result.steps.filter((s) => typeof s === 'string' && s.trim()) : [];
      if (steps.length === 0) {
        setErrorMsg("Couldn't come up with steps for this one — you can always add them yourself from the edit screen.");
        return;
      }
      const updated = { ...detail, steps };
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      setDetail(updated);
      setErrorMsg('Heads up: these steps were written by Claude from the ingredient list, not the original source — worth a read-through before you cook.');
    } catch {
      setErrorMsg('Could not generate steps right now. Please try again.');
    } finally {
      setGeneratingSteps(false);
    }
  }

  async function handleImageLoadError() {
    if (!detail || !detail.image) return;
    setErrorMsg("That photo wouldn't load — the source may block other sites from linking to it directly. Try finding another one, or add your own from the edit screen.");
    const updated = { ...detail, image: null };
    setDetail(updated);
    try {
      await window.storage.set(`recipe-full:${updated.id}`, JSON.stringify(updated), false);
      const newIndex = index.map((r) => (r.id === updated.id ? { ...r, thumbnail: null } : r));
      await persistIndex(newIndex);
    } catch {
      // non-critical — worst case the broken link just gets tried again next visit
    }
  }

  async function enterCookMode() {
    setCookStepIndex(0);
    setView('cook');
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // silently ignore — wake lock is a nice-to-have, not critical
    }
  }

  function exitCookMode() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setTimerRunning(false);
    if (isMealCook) {
      setIsMealCook(false);
      setDetail(null);
      setView('grid');
    } else {
      setView('detail');
    }
  }

  // Loads the selected recipes' full data, asks Claude to interleave their steps into one
  // sequence (see mergeStepsForMeal), merges their ingredients the same way the shopping-list
  // merge already does, then drops the result straight into the existing Cook Mode — reusing all
  // of its timer parsing, ingredient chips, and voice control with no separate UI to maintain.
  async function startMealCook() {
    if (mealSelectedIds.length < 2) {
      setMealError('Pick at least 2 recipes to combine.');
      return;
    }
    setMealMerging(true);
    setMealError('');
    try {
      const recipes = [];
      for (const id of mealSelectedIds) {
        const r = await window.storage.get(`recipe-full:${id}`, false).catch(() => null);
        if (r) recipes.push(JSON.parse(r.value));
      }
      if (recipes.length < 2) throw new Error('Could not load those recipes.');

      const { mealTitle, steps, ingredients } = await mergeStepsForMeal(recipes);

      const mealDetail = {
        id: `meal-${Date.now()}`,
        title: mealTitle,
        servings: recipes.map((r) => r.servings).filter(Boolean).join(' / '),
        time: '',
        ingredients,
        steps,
        tags: ['combined meal'],
        sourceRecipes: recipes.map((r) => r.title),
      };

      setDetail(mealDetail);
      setIsMealCook(true);
      setMealMode(false);
      setMealSelectedIds([]);
      await enterCookMode();
    } catch (err) {
      setMealError(err?.message || 'Could not combine those recipes. Please try again.');
    } finally {
      setMealMerging(false);
    }
  }

  async function exportLibrary() {
    if (exporting) return;
    setExporting(true);
    try {
      const results = [];
      for (const entry of index) {
        try {
          const r = await window.storage.get(`recipe-full:${entry.id}`, false);
          if (r) results.push(JSON.parse(r.value));
        } catch {
          // skip recipes that fail to load rather than aborting the whole export
        }
      }
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipe-box-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function handleImportFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        setImportToast({ type: 'error', text: 'Could not read that file — is it a Recipeasypeasy backup?' });
        setTimeout(() => setImportToast(null), 3500);
        return;
      }
      if (!Array.isArray(parsed)) {
        setImportToast({ type: 'error', text: 'That file doesn\u2019t look like a Recipeasypeasy backup.' });
        setTimeout(() => setImportToast(null), 3500);
        return;
      }
      const valid = parsed.filter((r) => r && typeof r === 'object' && typeof r.title === 'string');
      if (valid.length === 0) {
        setImportToast({ type: 'error', text: 'No readable recipes were found in that file.' });
        setTimeout(() => setImportToast(null), 3500);
        return;
      }
      const skipped = parsed.length - valid.length;
      setConfirmDialog({
        title: 'Import backup?',
        message: `${valid.length} recipe${valid.length === 1 ? '' : 's'} will be added to your library alongside what\u2019s already there.${skipped > 0 ? ` (${skipped} entr${skipped === 1 ? 'y was' : 'ies were'} unreadable and will be skipped.)` : ''}`,
        confirmLabel: 'Import',
        danger: false,
        onConfirm: () => { setConfirmDialog(null); performImport(valid); },
      });
    };
    reader.onerror = () => {
      setImportToast({ type: 'error', text: 'Could not read that file.' });
      setTimeout(() => setImportToast(null), 3500);
    };
    reader.readAsText(file);
  }

  async function performImport(recipes) {
    setImporting(true);
    try {
      const newEntries = [];
      for (const r of recipes) {
        const id = uid();
        const ingredientsArr = Array.isArray(r.ingredients) ? r.ingredients : [];
        const stepsArr = Array.isArray(r.steps) ? r.steps : [];
        const tagsArr = Array.isArray(r.tags) ? r.tags : [];
        const fullData = {
          ...r,
          id,
          title: r.title || 'Untitled recipe',
          ingredients: ingredientsArr,
          steps: stepsArr,
          tags: tagsArr,
          notes: typeof r.notes === 'string' ? r.notes : '',
          rating: typeof r.rating === 'number' ? r.rating : 0,
          createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        };
        await window.storage.set(`recipe-full:${id}`, JSON.stringify(fullData), false);
        newEntries.push({
          id,
          title: fullData.title,
          tags: tagsArr,
          thumbnail: fullData.image || null,
          ingredientsPreview: ingredientsArr,
          time: fullData.time || '',
          rating: fullData.rating,
          createdAt: fullData.createdAt,
        });
      }
      await persistIndex([...newEntries, ...index]);
      setImportToast({ type: 'success', text: `Imported ${newEntries.length} recipe${newEntries.length === 1 ? '' : 's'}.` });
    } catch {
      setImportToast({ type: 'error', text: 'Import failed partway through — some recipes may not have been added.' });
    } finally {
      setImporting(false);
      setTimeout(() => setImportToast(null), 3500);
    }
  }

  async function runApiTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiConnection();
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(`THROW: ${err?.name} — ${err?.message}`);
    } finally {
      setTesting(false);
    }
  }

  const baseServings = detail ? parseServingsNumber(detail.servings) : null;
  const scaleFactor = baseServings && displayServings ? displayServings / baseServings : 1;
  const seasonalMatches = useMemo(
    () => (detail ? getSeasonalMatches(detail.ingredients || []) : { inSeason: [], outOfSeason: [] }),
    [detail]
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.paper, fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      <style>{FONT_IMPORT}</style>

      {/* Header */}
      {view !== 'cook' && (
        <div style={{ background: COLORS.ink, padding: '20px 16px 16px' }}>
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ChefHat size={22} color={COLORS.mustard} />
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '22px', color: COLORS.cream, margin: 0, letterSpacing: '0.01em' }}>
                Recipeasypeasy
              </h1>
            </div>
            {view === 'grid' && index.length > 0 && !selectMode && !mealMode && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
                <button
                  onClick={() => setView('shopping')}
                  style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                >
                  <ShoppingCart size={20} />
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Shop</span>
                  {uncheckedCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-2px', right: '0px', background: COLORS.mustard, color: COLORS.ink,
                      fontSize: '9px', fontWeight: 700, borderRadius: '8px', minWidth: '15px', height: '15px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1,
                    }}>
                      {uncheckedCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={toggleSelectMode}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                >
                  <ListPlus size={20} />
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Select</span>
                </button>
                <button
                  onClick={toggleMealMode}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                >
                  <Layers size={20} />
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Combine</span>
                </button>
                <button
                  onClick={() => setView('planner')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                >
                  <Calendar size={20} />
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Planner</span>
                </button>
                <button
                  onClick={() => setView('index')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                >
                  <BookOpen size={20} />
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Index</span>
                </button>
                <button
                  onClick={exporting ? undefined : exportLibrary}
                  aria-disabled={exporting}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: exporting ? 'default' : 'pointer', padding: '4px 6px', pointerEvents: exporting ? 'none' : 'auto' }}
                >
                  {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Export</span>
                </button>
                <button
                  onClick={importing ? undefined : () => importInputRef.current?.click()}
                  aria-disabled={importing}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: importing ? 'default' : 'pointer', padding: '4px 6px', pointerEvents: importing ? 'none' : 'auto' }}
                >
                  {importing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Import</span>
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFileChange}
                  style={{ display: 'none' }}
                />
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0, background: 'none', border: 'none', color: COLORS.cream, opacity: 0.8, cursor: 'pointer', padding: '4px 6px' }}
                  >
                    <LogOut size={20} />
                    <span style={{ fontSize: '8.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sign out</span>
                  </button>
                )}
              </div>
            )}
            {view === 'grid' && selectMode && (
              <button
                onClick={toggleSelectMode}
                style={{ background: 'none', border: 'none', color: COLORS.cream, opacity: 0.85, cursor: 'pointer', padding: '4px', fontSize: '13px', fontWeight: 600 }}
              >
                Cancel
              </button>
            )}
            {view === 'grid' && mealMode && (
              <button
                onClick={toggleMealMode}
                style={{ background: 'none', border: 'none', color: COLORS.cream, opacity: 0.85, cursor: 'pointer', padding: '4px', fontSize: '13px', fontWeight: 600 }}
              >
                Cancel
              </button>
            )}
          </div>
          {view === 'grid' && selectMode && (
            <div style={{ color: COLORS.cream, opacity: 0.7, fontSize: '12.5px', marginBottom: '2px' }}>
              Tap recipes to add their ingredients to your shopping list
            </div>
          )}
          {view === 'grid' && mealMode && (
            <div style={{ color: COLORS.cream, opacity: 0.7, fontSize: '12.5px', marginBottom: '2px' }}>
              Tap 2 or more recipes to combine into one meal
            </div>
          )}
          {view === 'grid' && !selectMode && !mealMode && (
            <>
              {!nationalDishDismissed && (
                <div style={{
                  background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '4px',
                  padding: '12px 14px', marginBottom: '12px', position: 'relative',
                }}>
                  <button
                    onClick={() => setNationalDishDismissed(true)}
                    title="Dismiss"
                    style={{
                      position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none',
                      color: COLORS.inkFaint, cursor: 'pointer', padding: '4px', display: 'flex',
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.sage, marginBottom: '6px' }}>
                    <Globe size={12} /> Today's dish from around the world
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingRight: '18px' }}>
                    <span style={{ fontSize: '26px', lineHeight: 1 }}>{todaysDish.flag}</span>
                    <div>
                      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '15px', color: COLORS.ink }}>
                        {todaysDish.dish} <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '12.5px', color: COLORS.inkFaint }}>— {todaysDish.country}</span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: COLORS.inkFaint, margin: '4px 0 0', lineHeight: 1.4 }}>
                        {todaysDish.fact}
                      </p>
                      {(() => {
                        const alreadyAdded = index.some((r) => (r.title || '').trim().toLowerCase() === todaysDish.dish.trim().toLowerCase());
                        return (
                          <button
                            onClick={alreadyAdded ? undefined : () => handleAddNationalDish(todaysDish)}
                            disabled={alreadyAdded}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '9px',
                              background: 'none', border: `1px solid ${alreadyAdded ? COLORS.cardBorder : COLORS.sage}`,
                              color: alreadyAdded ? COLORS.inkFaint : COLORS.sage,
                              borderRadius: '3px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 600,
                              cursor: alreadyAdded ? 'default' : 'pointer',
                            }}
                          >
                            {alreadyAdded ? <Check size={12} /> : <Plus size={12} />}
                            {alreadyAdded ? 'Already in your Recipeasypeasy' : 'Add to Recipeasypeasy'}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: allTags.length ? '10px' : 0 }}>
                <Search size={16} color={COLORS.inkFaint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or ingredient…"
                  style={{
                    width: '100%', boxSizing: 'border-box', background: COLORS.cream, border: 'none',
                    borderRadius: '3px', padding: '10px 12px 10px 34px', fontFamily: 'Inter, sans-serif',
                    fontSize: '14px', color: COLORS.ink, outline: 'none',
                  }}
                />
              </div>
              {allTags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', marginBottom: '10px' }}>
                  {allTags.map((t) => (
                    <Chip key={t} active={selectedTag === t} onClick={() => setSelectedTag(selectedTag === t ? null : t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              )}
              {index.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: COLORS.cream, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      background: COLORS.cream, border: 'none', borderRadius: '3px', padding: '5px 8px',
                      fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: COLORS.ink,
                      outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="az">A–Z</option>
                    <option value="quickest">Quickest first</option>
                    <option value="rating">Top rated</option>
                  </select>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {view === 'grid' && (
        <div style={{ padding: '16px', maxWidth: '840px', margin: '0 auto' }}>
          {loadingIndex ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: COLORS.inkFaint }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: COLORS.inkFaint }}>
              <ChefHat size={30} style={{ marginBottom: '10px', opacity: 0.5 }} />
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '17px', color: COLORS.ink, marginBottom: '4px' }}>
                {index.length === 0 ? 'Your box is empty' : 'No matches'}
              </p>
              <p style={{ fontSize: '13px' }}>
                {index.length === 0 ? 'Snap a photo of a recipe to file the first card.' : 'Try a different search or tag.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {sorted.map((entry) => (
                <div key={entry.id} style={{ position: 'relative' }}>
                  <RecipeCard
                    entry={entry}
                    onClick={() => (selectMode ? toggleRecipeSelected(entry.id) : mealMode ? toggleMealRecipeSelected(entry.id) : openDetail(entry.id))}
                  />
                  {selectMode && (
                    <div
                      style={{
                        position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '5px',
                        background: selectedRecipeIds.includes(entry.id) ? COLORS.sage : 'rgba(255,253,248,0.9)',
                        border: `1.5px solid ${selectedRecipeIds.includes(entry.id) ? COLORS.sage : COLORS.cardBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'none',
                      }}
                    >
                      {selectedRecipeIds.includes(entry.id) && <Check size={15} color={COLORS.cream} />}
                    </div>
                  )}
                  {mealMode && (
                    <div
                      style={{
                        position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '5px',
                        background: mealSelectedIds.includes(entry.id) ? COLORS.rust : 'rgba(255,253,248,0.9)',
                        border: `1.5px solid ${mealSelectedIds.includes(entry.id) ? COLORS.rust : COLORS.cardBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'none',
                      }}
                    >
                      {mealSelectedIds.includes(entry.id) && <Check size={15} color={COLORS.cream} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!selectMode && !mealMode && (
            <button
              onClick={() => { resetAddFlow(); setView('add'); }}
              style={{
                position: 'fixed', bottom: '14px', right: '14px', width: '58px', height: '58px', borderRadius: '50%',
                background: COLORS.rust, color: COLORS.cream, border: `3px solid ${COLORS.cream}`, boxShadow: '0 4px 16px rgba(43,38,32,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20,
              }}
            >
              <Plus size={26} />
            </button>
          )}

          {selectMode && selectedRecipeIds.length > 0 && (
            <button
              onClick={addSelectedToShoppingList}
              style={{
                position: 'fixed', bottom: '20px', left: '16px', right: '16px', background: COLORS.rust, color: COLORS.cream,
                border: 'none', borderRadius: '4px', padding: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                fontSize: '15px', cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <ShoppingCart size={17} /> Add {selectedRecipeIds.length} recipe{selectedRecipeIds.length > 1 ? 's' : ''} to shopping list
            </button>
          )}

          {mealMode && (
            <div style={{ position: 'fixed', bottom: '20px', left: '16px', right: '16px' }}>
              {mealError && (
                <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.rust}`, borderRadius: '4px', padding: '10px 12px', marginBottom: '8px', fontSize: '13px', color: COLORS.rust, textAlign: 'center' }}>
                  {mealError}
                </div>
              )}
              {mealSelectedIds.length > 0 && (
                <button
                  onClick={mealMerging ? undefined : startMealCook}
                  aria-disabled={mealMerging}
                  style={{
                    width: '100%', background: COLORS.rust, color: COLORS.cream,
                    border: 'none', borderRadius: '4px', padding: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                    fontSize: '15px', cursor: mealMerging ? 'default' : 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: mealMerging ? 0.7 : 1,
                  }}
                >
                  {mealMerging ? (
                    <><Loader2 size={17} className="animate-spin" /> Combining steps…</>
                  ) : (
                    <><Layers size={17} /> Combine {mealSelectedIds.length} recipe{mealSelectedIds.length > 1 ? 's' : ''} into a meal</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* INDEX VIEW */}
      {view === 'index' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setView('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <LayoutGrid size={16} /> Back to shelves
          </button>

          {Object.keys(groupedIndex).sort().map((letter) => (
            <div key={letter} style={{ marginBottom: '18px' }}>
              <div style={{
                fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '15px', color: COLORS.cream,
                background: COLORS.rust, width: '26px', height: '26px', borderRadius: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px',
              }}>
                {letter}
              </div>
              <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px' }}>
                {groupedIndex[letter].map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '11px 14px',
                      borderBottom: i < groupedIndex[letter].length - 1 ? `1px solid ${COLORS.paperDark}` : 'none',
                      fontFamily: 'Inter, sans-serif', fontSize: '14.5px', color: COLORS.ink,
                    }}
                  >
                    {r.title || 'Untitled recipe'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SHOPPING LIST VIEW */}
      {view === 'shopping' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setView('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <ChevronLeft size={16} /> Back to library
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '22px', color: COLORS.ink, margin: 0 }}>
              Shopping List
            </h2>
            {index.length > 0 && (
              <button
                onClick={() => { setSelectMode(true); setView('grid'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: `1px solid ${COLORS.sage}`, color: COLORS.sage, borderRadius: '3px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <ListPlus size={14} /> Add recipes
              </button>
            )}
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', gap: '8px', background: '#F6E4DC', color: COLORS.rustDark, padding: '10px 12px', borderRadius: '3px', fontSize: '13px', marginBottom: '14px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustomItem(); }}
              placeholder="Add an item…"
              style={{ ...inputStyle(), flex: 1 }}
            />
            <button
              onClick={addCustomItem}
              disabled={!newItemText.trim()}
              style={{
                background: newItemText.trim() ? COLORS.sage : COLORS.cardBorder, color: COLORS.cream, border: 'none',
                borderRadius: '3px', padding: '0 16px', cursor: newItemText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
              }}
            >
              <Plus size={18} />
            </button>
          </div>

          {uncheckedCount > 0 && (
            <button
              onClick={copyShoppingListToClipboard}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%',
                background: listCopied ? COLORS.sage : 'none', color: listCopied ? COLORS.cream : COLORS.rustDark,
                border: `1px solid ${listCopied ? COLORS.sage : COLORS.mustard}`, borderRadius: '3px',
                padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px',
              }}
            >
              {listCopied ? <Check size={15} /> : <Copy size={15} />}
              {listCopied ? 'Copied!' : 'Copy list for online shop'}
            </button>
          )}

          {uncheckedCount > 0 && (
            <a
              href="https://www.sainsburys.co.uk/gol-ui/search-a-list-of-items"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                color: COLORS.inkFaint, fontSize: '12px', textDecoration: 'none', marginBottom: '16px',
              }}
            >
              Open Sainsbury's list search <ExternalLink size={12} />
            </a>
          )}

          {copyFallbackText != null && (
            <div style={{ background: COLORS.paperDark, border: `1px solid ${COLORS.mustard}`, borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.rustDark }}>
                  Couldn't copy automatically — tap the box, select all, then copy
                </span>
                <button
                  onClick={() => setCopyFallbackText(null)}
                  style={{ background: 'none', border: 'none', color: COLORS.inkFaint, cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                readOnly
                value={copyFallbackText}
                onFocus={(e) => e.target.select()}
                rows={Math.min(10, copyFallbackText.split('\n').length)}
                style={{ ...inputStyle(), fontFamily: 'JetBrains Mono, monospace', fontSize: '12.5px', resize: 'vertical' }}
              />
            </div>
          )}

          {loadingShoppingList ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: COLORS.inkFaint }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : shoppingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: COLORS.inkFaint }}>
              <ShoppingCart size={30} style={{ marginBottom: '10px', opacity: 0.5 }} />
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '17px', color: COLORS.ink, marginBottom: '4px' }}>
                Your list is empty
              </p>
              <p style={{ fontSize: '13px' }}>
                Add items above, or tap "Add recipes" to pull in ingredients.
              </p>
            </div>
          ) : (
            <>
              {groupedShoppingList.map((group, gi) => (
                <div key={gi} style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.rustDark, marginBottom: '6px' }}>
                    {group.title}
                  </div>
                  <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px' }}>
                    {group.items.map((item, i) => {
                      const { qty, rest } = shoppingItemLabel(item.text);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleShoppingItem(item.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '11px 14px',
                            borderBottom: i < group.items.length - 1 ? `1px solid ${COLORS.paperDark}` : 'none',
                          }}
                        >
                          {item.checked ? <CheckSquare size={18} color={COLORS.sage} style={{ flexShrink: 0 }} /> : <Square size={18} color={COLORS.cardBorder} style={{ flexShrink: 0 }} />}
                          <span style={{
                            fontFamily: qty ? 'JetBrains Mono, monospace' : 'Inter, sans-serif', fontSize: '14px',
                            color: item.checked ? COLORS.inkFaint : COLORS.ink,
                            textDecoration: item.checked ? 'line-through' : 'none',
                          }}>
                            {qty && <span style={{ color: item.checked ? COLORS.inkFaint : COLORS.mustard, fontWeight: 700, marginRight: '6px' }}>{qty}</span>}
                            {rest}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={clearCheckedItems}
                  disabled={uncheckedCount === shoppingList.length}
                  style={{
                    flex: 1, background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint,
                    borderRadius: '3px', padding: '10px', fontSize: '13px', cursor: 'pointer',
                    opacity: uncheckedCount === shoppingList.length ? 0.5 : 1,
                  }}
                >
                  Clear checked
                </button>
                <button
                  onClick={() => setConfirmDialog({
                    title: 'Clear shopping list?',
                    message: 'All items — checked and unchecked — will be removed from your list.',
                    confirmLabel: 'Clear all',
                    danger: true,
                    onConfirm: () => { setConfirmDialog(null); clearAllItems(); },
                  })}
                  style={{ flex: 1, background: 'none', border: `1px solid ${COLORS.rust}`, color: COLORS.rust, borderRadius: '3px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* MEAL PLANNER VIEW */}
      {view === 'planner' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setView('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <ChevronLeft size={16} /> Back to library
          </button>

          <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '22px', color: COLORS.ink, margin: '0 0 4px' }}>
            This Week's Plan
          </h2>
          <p style={{ fontSize: '13px', color: COLORS.inkFaint, margin: '0 0 16px' }}>
            Pick an evening meal for each day, then generate a combined shopping list.
          </p>

          {errorMsg && (
            <div style={{ display: 'flex', gap: '8px', background: '#F6E4DC', color: COLORS.rustDark, padding: '10px 12px', borderRadius: '3px', fontSize: '13px', marginBottom: '14px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {loadingMealPlan ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: COLORS.inkFaint }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : (
            <>
              <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px', marginBottom: '18px' }}>
                {mealPlan.map((d, i) => {
                  const recipe = d.recipeId ? index.find((r) => r.id === d.recipeId) : null;
                  return (
                    <div
                      key={d.day}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                        borderBottom: i < mealPlan.length - 1 ? `1px solid ${COLORS.paperDark}` : 'none',
                      }}
                    >
                      <div style={{ width: '78px', flexShrink: 0, fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '14px', color: COLORS.rustDark }}>
                        {d.day}
                      </div>
                      {recipe ? (
                        <>
                          <button
                            onClick={() => openDayPicker(i)}
                            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                          >
                            <div style={{ fontSize: '14px', color: COLORS.ink, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {recipe.title || 'Untitled recipe'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <TimeTag category={getTimeCategory(recipe.time)} />
                              {recipe.time && <span style={{ fontSize: '11px', color: COLORS.inkFaint }}>{recipe.time}</span>}
                            </div>
                          </button>
                          <button
                            onClick={() => clearDay(i)}
                            title="Remove"
                            style={{ background: 'none', border: 'none', color: COLORS.inkFaint, cursor: 'pointer', flexShrink: 0, padding: '4px' }}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openDayPicker(i)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: COLORS.sage, cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, padding: 0, textAlign: 'left' }}
                        >
                          <Plus size={15} /> Choose a recipe
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {mealPlan.some((d) => !d.recipeId) && index.length > 0 && (
                <button
                  onClick={autoFilling ? undefined : autoFillEmptyDays}
                  aria-disabled={autoFilling}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: 'none', color: COLORS.sage, border: `1px solid ${COLORS.sage}`, borderRadius: '3px',
                    padding: '12px', fontWeight: 600, fontSize: '14px', cursor: autoFilling ? 'default' : 'pointer', marginBottom: '10px',
                    pointerEvents: autoFilling ? 'none' : 'auto',
                  }}
                >
                  {autoFilling ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {autoFilling ? 'Filling in the rest…' : 'Auto-fill remaining days'}
                </button>
              )}

              <button
                onClick={generatingPlanList || mealPlan.every((d) => !d.recipeId) ? undefined : generatePlanShoppingList}
                disabled={mealPlan.every((d) => !d.recipeId)}
                aria-disabled={generatingPlanList}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: mealPlan.some((d) => d.recipeId) ? COLORS.rust : COLORS.cardBorder, color: COLORS.cream,
                  border: 'none', borderRadius: '3px', padding: '13px', fontWeight: 600, fontSize: '15px',
                  cursor: mealPlan.some((d) => d.recipeId) && !generatingPlanList ? 'pointer' : 'default',
                  pointerEvents: generatingPlanList ? 'none' : 'auto',
                }}
              >
                {generatingPlanList ? <Loader2 size={17} className="animate-spin" /> : <ShoppingCart size={17} />}
                {generatingPlanList ? 'Combining ingredients…' : 'Generate shopping list from plan'}
              </button>
            </>
          )}
        </div>
      )}

      {/* MEAL PLANNER: CHOOSE RECIPE VIEW */}
      {view === 'plannerPick' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => { setView('planner'); setPickingDayIndex(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <ChevronLeft size={16} /> Back to plan
          </button>

          <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '20px', color: COLORS.ink, margin: '0 0 4px' }}>
            {pickingDayIndex != null ? `Choose ${WEEK_DAYS[pickingDayIndex]}'s recipe` : 'Choose a recipe'}
          </h2>

          <div style={{ position: 'relative', margin: '14px 0' }}>
            <Search size={16} color={COLORS.inkFaint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={plannerQuery}
              onChange={(e) => setPlannerQuery(e.target.value)}
              placeholder="Search your recipes…"
              style={{ ...inputStyle(), paddingLeft: '34px' }}
            />
          </div>

          {index.length === 0 ? (
            <p style={{ color: COLORS.inkFaint, fontSize: '13px' }}>Your box is empty — add some recipes first.</p>
          ) : (
            (() => {
              const q = plannerQuery.trim().toLowerCase();
              const matches = index
                .filter((r) => !q || (r.title || '').toLowerCase().includes(q))
                .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
              if (matches.length === 0) {
                return <p style={{ color: COLORS.inkFaint, fontSize: '13px' }}>No matches.</p>;
              }
              return (
                <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px' }}>
                  {matches.map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => assignRecipeToDay(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '11px 14px',
                        borderBottom: i < matches.length - 1 ? `1px solid ${COLORS.paperDark}` : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', color: COLORS.ink, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.title || 'Untitled recipe'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <TimeTag category={getTimeCategory(r.time)} />
                          {r.time && <span style={{ fontSize: '11px', color: COLORS.inkFaint }}>{r.time}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ADD VIEW */}
      {view === 'add' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => { resetAddFlow(); setView('grid'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <ChevronLeft size={16} /> Back to library
          </button>

          {addStage === 'capture' && addMode === null && (
            <div>
              <p style={{ fontSize: '13px', color: COLORS.inkFaint, marginBottom: '14px' }}>
                How would you like to add this recipe?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { mode: 'photo', icon: Camera, title: 'Photograph a recipe', desc: 'From a magazine, cookbook, or clipping.' },
                  { mode: 'paste', icon: ExternalLink, title: 'From a URL or pasted text', desc: "Paste a link — including YouTube, TikTok, or Instagram — or the recipe text itself." },
                  { mode: 'manual', icon: Pencil, title: 'Add your own recipe', desc: 'Type it in yourself — no AI involved.' },
                  { mode: 'ingredients', icon: Sparkles, title: 'From ingredients I have', desc: "Photograph or list what's in the fridge and we'll invent something." },
                  { mode: 'meal', icon: Utensils, title: 'From a photo of a meal', desc: "Snap a finished dish — in a restaurant, from a friend, wherever — and we'll work out a recipe for it." },
                ].map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => (opt.mode === 'manual' ? handleStartManualEntry() : setAddMode(opt.mode))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left', width: '100%',
                      background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '4px',
                      padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <opt.icon size={20} color={COLORS.rust} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '15px', color: COLORS.ink }}>{opt.title}</div>
                      <div style={{ fontSize: '12.5px', color: COLORS.inkFaint, marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={runApiTest}
                disabled={testing}
                style={{ background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}
              >
                {testing ? 'Testing…' : 'Test API connection'}
              </button>
              {testResult && (
                <pre style={{ textAlign: 'left', fontSize: '11px', background: COLORS.paper, color: COLORS.ink, padding: '10px', borderRadius: '3px', marginTop: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflow: 'auto' }}>
                  {testResult}
                </pre>
              )}
            </div>
          )}

          {addStage === 'capture' && addMode !== null && (
            <div style={{ background: COLORS.cream, border: `1px dashed ${COLORS.cardBorder}`, borderRadius: '4px', padding: '32px 20px', textAlign: 'center' }}>
              <button
                onClick={backToAddMethodMenu}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '18px', fontSize: '12.5px', padding: 0 }}
              >
                <ChevronLeft size={14} /> Choose a different way to add
              </button>

              {/* Shared across the photo and ingredients modes below — both have a "take/choose
                  photos" button that needs this mounted regardless of which mode is active. */}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} style={{ display: 'none' }} />

              {addMode === 'photo' ? (
                <>
                  <Camera size={30} color={COLORS.rust} style={{ marginBottom: '12px' }} />
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '18px', color: COLORS.ink, marginBottom: '6px' }}>
                    Photograph a recipe
                  </p>
                  <p style={{ fontSize: '13px', color: COLORS.inkFaint, marginBottom: '18px' }}>
                    From a magazine, cookbook, or clipping. Add more photos if the recipe spans several pages.
                  </p>

                  {pendingPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                      {pendingPhotos.map((p, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p.thumb} alt="" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '3px', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                          <button
                            onClick={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingPhotos.length < 6 && (
                    <button
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        background: pendingPhotos.length === 0 ? COLORS.rust : 'transparent',
                        color: pendingPhotos.length === 0 ? COLORS.cream : COLORS.rust,
                        border: pendingPhotos.length === 0 ? 'none' : `1px solid ${COLORS.rust}`,
                        borderRadius: '3px', padding: '11px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                        fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px',
                      }}
                    >
                      {pendingPhotos.length === 0 ? <Camera size={16} /> : <ImagePlus size={16} />}
                      {pendingPhotos.length === 0 ? 'Take or choose photos' : 'Add more photos'}
                    </button>
                  )}

                  {pendingPhotos.length > 0 && (
                    <button
                      onClick={handleExtract}
                      style={{
                        background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '3px',
                        padding: '11px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                      }}
                    >
                      Extract recipe
                    </button>
                  )}
                </>
              ) : addMode === 'paste' ? (
                <>
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '18px', color: COLORS.ink, marginBottom: '6px' }}>
                    Paste a recipe
                  </p>
                  <p style={{ fontSize: '13px', color: COLORS.inkFaint, marginBottom: '14px' }}>
                    Paste a recipe URL — including a YouTube, TikTok, or Instagram link — and we'll look it up and read it for you. If it can't find enough there, copy the recipe text (or the video's caption) and paste it here instead.
                  </p>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste a URL (including YouTube/TikTok/Instagram), or the recipe text itself…"
                    style={{ ...inputStyle(), resize: 'vertical', marginBottom: '14px', textAlign: 'left' }}
                  />
                  <button
                    onClick={handlePasteExtract}
                    disabled={!pastedText.trim()}
                    style={{
                      background: pastedText.trim() ? COLORS.sage : COLORS.cardBorder, color: COLORS.cream, border: 'none', borderRadius: '3px',
                      padding: '11px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
                      cursor: pastedText.trim() ? 'pointer' : 'default',
                    }}
                  >
                    {looksLikeVideoUrl(pastedText) ? 'Watch & extract recipe' : looksLikeUrl(pastedText) ? 'Fetch & extract recipe' : 'Extract recipe'}
                  </button>
                </>
              ) : addMode === 'ingredients' ? (
                <>
                  <Sparkles size={30} color={COLORS.rust} style={{ marginBottom: '12px' }} />
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '18px', color: COLORS.ink, marginBottom: '6px' }}>
                    Cook from what you've got
                  </p>
                  <p style={{ fontSize: '13px', color: COLORS.inkFaint, marginBottom: '18px' }}>
                    Photograph what's in the fridge or cupboard, list what you have, or both — we'll invent a recipe using it.
                  </p>

                  {pendingPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                      {pendingPhotos.map((p, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p.thumb} alt="" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '3px', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                          <button
                            onClick={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingPhotos.length < 6 && (
                    <button
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        background: 'transparent', color: COLORS.rust, border: `1px solid ${COLORS.rust}`,
                        borderRadius: '3px', padding: '10px 18px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                        fontSize: '13.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px',
                      }}
                    >
                      <Camera size={15} />
                      {pendingPhotos.length === 0 ? 'Photograph ingredients' : 'Add more photos'}
                    </button>
                  )}

                  <textarea
                    rows={4}
                    value={ingredientsText}
                    onChange={(e) => setIngredientsText(e.target.value)}
                    placeholder="Or list what you have, e.g. chicken thighs, spinach, coconut milk, rice…"
                    style={{ ...inputStyle(), resize: 'vertical', marginBottom: '14px', textAlign: 'left' }}
                  />

                  <button
                    onClick={handleGenerateFromIngredients}
                    disabled={pendingPhotos.length === 0 && !ingredientsText.trim()}
                    style={{
                      background: (pendingPhotos.length > 0 || ingredientsText.trim()) ? COLORS.sage : COLORS.cardBorder,
                      color: COLORS.cream, border: 'none', borderRadius: '3px', padding: '11px 22px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
                      cursor: (pendingPhotos.length > 0 || ingredientsText.trim()) ? 'pointer' : 'default',
                    }}
                  >
                    Generate a recipe
                  </button>
                </>
              ) : (
                <>
                  <Utensils size={30} color={COLORS.rust} style={{ marginBottom: '12px' }} />
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '18px', color: COLORS.ink, marginBottom: '6px' }}>
                    From a photo of a meal
                  </p>
                  <p style={{ fontSize: '13px', color: COLORS.inkFaint, marginBottom: '18px' }}>
                    Snap a finished, plated dish and we'll work out what it is and how to make it. The photo becomes the recipe's picture.
                  </p>

                  {pendingPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                      {pendingPhotos.map((p, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p.thumb} alt="" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '3px', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                          <button
                            onClick={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingPhotos.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        background: pendingPhotos.length === 0 ? COLORS.rust : 'transparent',
                        color: pendingPhotos.length === 0 ? COLORS.cream : COLORS.rust,
                        border: pendingPhotos.length === 0 ? 'none' : `1px solid ${COLORS.rust}`,
                        borderRadius: '3px', padding: '11px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                        fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px',
                      }}
                    >
                      {pendingPhotos.length === 0 ? <Camera size={16} /> : <ImagePlus size={16} />}
                      {pendingPhotos.length === 0 ? 'Take or choose a photo' : 'Add another angle'}
                    </button>
                  )}

                  <input
                    type="text"
                    value={mealPhotoContext}
                    onChange={(e) => setMealPhotoContext(e.target.value)}
                    placeholder="Optional: anything that helps identify it, e.g. &quot;this is a coffee cake, not chocolate&quot;"
                    style={{ ...inputStyle(), marginTop: '14px', marginBottom: '14px', textAlign: 'left' }}
                  />

                  {pendingPhotos.length > 0 && (
                    <button
                      onClick={handleGenerateFromMealPhoto}
                      style={{
                        background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '3px',
                        padding: '11px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                      }}
                    >
                      Work out the recipe
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {addStage === 'extracting' && (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              {pendingPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
                  {pendingPhotos.map((p, i) => (
                    <img key={i} src={p.thumb} alt="" style={{ width: '90px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: COLORS.ink }}>
                <Loader2 size={18} className="animate-spin" />
                <span style={{ fontSize: '14px' }}>{retryingSmaller ? 'That photo was a bit large — retrying with a smaller copy…' : generatingDish ? 'Writing up the recipe…' : generatingFromIngredients ? 'Inventing a recipe…' : generatingFromMealPhoto ? 'Working out the recipe…' : extractingVideo ? 'Reading the video…' : 'Reading the recipe…'}</span>
              </div>
            </div>
          )}

          {addStage === 'review' && form && (
            <div>
              {errorMsg && (
                <div style={{ display: 'flex', gap: '8px', background: '#F6E4DC', color: COLORS.rustDark, padding: '10px 12px', borderRadius: '3px', fontSize: '13px', marginBottom: '14px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{errorMsg}</span>
                </div>
              )}
              {pendingPhotos[0] ? (
                <img src={pendingPhotos[0].thumb} alt="" style={{ width: '100%', maxWidth: '220px', borderRadius: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
              ) : fetchedImageUrl ? (
                <FetchedImagePreview
                  url={fetchedImageUrl}
                  onRemove={() => setFetchedImageUrl('')}
                  onError={() => { setFetchedImageUrl(''); setUrlImageBlocked(true); }}
                />
              ) : urlImageBlocked ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: COLORS.inkFaint, fontSize: '12.5px', marginBottom: '16px' }}>
                  <ImagePlus size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>A photo was found on that page, but it wouldn't load here — some sites block other sites from linking to their images directly. You can save without it, or add your own from the edit screen.</span>
                </div>
              ) : urlExtractHadNoImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.inkFaint, fontSize: '12.5px', marginBottom: '16px' }}>
                  <ImagePlus size={14} /> No photo could be identified on that page.
                </div>
              ) : null}

              <RecipeFormFields form={form} setForm={setForm} />

              <button
                onClick={handleSaveRecipe}
                style={{ width: '100%', background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '3px', padding: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer', marginTop: '6px' }}
              >
                File this recipe
              </button>
            </div>
          )}
        </div>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && (
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setView('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.inkFaint, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', fontSize: '14px', padding: 0 }}
          >
            <ChevronLeft size={16} /> Back to library
          </button>

          {loadingDetail ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: COLORS.inkFaint }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : !detail ? (
            <p style={{ color: COLORS.inkFaint }}>Couldn't load this recipe.</p>
          ) : editing ? (
            <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '4px', padding: '16px' }}>
              <RecipeFormFields
                form={editForm}
                setForm={setEditForm}
                image={editForm.image}
                onImageChange={(img) => setEditForm({ ...editForm, image: img })}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={saveEdit}
                  style={{ flex: 1, background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '3px', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  Save changes
                </button>
                <button
                  onClick={() => setEditing(false)}
                  style={{ background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px', padding: '12px 16px', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '4px', padding: '16px' }}>
              {errorMsg && (
                <div style={{ display: 'flex', gap: '8px', background: '#F6E4DC', color: COLORS.rustDark, padding: '10px 12px', borderRadius: '3px', fontSize: '13px', marginBottom: '14px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{errorMsg}</span>
                </div>
              )}
              <DetailHeroImage
                key={detail.image || 'none'}
                src={detail.image}
                alt={detail.title}
                tags={detail.tags}
                onFindPhoto={handleFindImage}
                finding={findingImage}
                onLoadError={handleImageLoadError}
                onOpenGallery={detail.image ? () => setGalleryIndex(0) : undefined}
              />
              {getGalleryExtras(detail).length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {getGalleryExtras(detail).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      onClick={() => setGalleryIndex(i + 1)}
                      style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '3px', cursor: 'pointer' }}
                    />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '22px', color: COLORS.ink, margin: '0 0 6px' }}>{detail.title}</h2>
                <button onClick={startEditing} title="Edit recipe" style={{ background: 'none', border: 'none', color: COLORS.inkFaint, cursor: 'pointer', flexShrink: 0, padding: '4px' }}>
                  <Pencil size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', color: COLORS.inkFaint, fontSize: '13px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {detail.time && <span>{detail.time}</span>}
                {baseServings ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Serves</span>
                    <button onClick={() => setDisplayServings((s) => Math.max(1, (s || baseServings) - 1))} style={{ background: COLORS.paperDark, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Minus size={11} />
                    </button>
                    <span style={{ minWidth: '16px', textAlign: 'center', fontWeight: 600, color: COLORS.ink }}>{displayServings || baseServings}</span>
                    <button onClick={() => setDisplayServings((s) => (s || baseServings) + 1)} style={{ background: COLORS.paperDark, border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Plus size={11} />
                    </button>
                  </div>
                ) : (
                  detail.servings && <span>Serves {detail.servings}</span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '16px' }}>
                <TimeTag category={getTimeCategory(detail.time)} />
                {(detail.tags || []).map((t, i) => <Chip key={i}>{t}</Chip>)}
              </div>

              {seasonalMatches.inSeason.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.sage, fontSize: '12.5px', marginBottom: '16px' }}>
                  <Leaf size={13} />
                  <span>
                    {seasonalMatches.inSeason.map((s) => s[0].toUpperCase() + s.slice(1)).join(', ')} {seasonalMatches.inSeason.length === 1 ? 'is' : 'are'} in season right now
                  </span>
                </div>
              ) : seasonalMatches.outOfSeason.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.inkFaint, fontSize: '12.5px', marginBottom: '16px' }}>
                  <Leaf size={13} style={{ opacity: 0.5 }} />
                  <span>
                    {seasonalMatches.outOfSeason.map((s) => s[0].toUpperCase() + s.slice(1)).join(', ')} {seasonalMatches.outOfSeason.length === 1 ? "isn't" : "aren't"} in season right now — may cost more or be trickier to find
                  </span>
                </div>
              ) : null}

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.inkFaint, marginBottom: '6px' }}>
                  Your rating
                </div>
                <StarRatingInput rating={detail.rating} onChange={setRating} />
              </div>

              {detail.steps.length > 0 && (
                <button
                  onClick={enterCookMode}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '3px', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '8px' }}
                >
                  <Utensils size={16} /> Cook mode
                </button>
              )}

              {detail.steps.length > 0 && (
                <button
                  onClick={() => startMealFrom(detail.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', background: 'none', color: COLORS.inkFaint, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '3px', padding: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', marginBottom: '20px' }}
                >
                  <Layers size={13} /> Combine with another recipe
                </button>
              )}

              <h3 style={sectionHeader()}>Ingredients</h3>
              <ul style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13.5px', color: COLORS.ink, lineHeight: 1.8, paddingLeft: '18px', margin: '0 0 18px' }}>
                {detail.ingredients.map((ing, i) => <li key={i}>{scaleIngredientText(ing, scaleFactor)}</li>)}
              </ul>

              <h3 style={sectionHeader()}>Nutrition (per serving)</h3>
              {detail.nutrition ? (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {[
                      ['Calories', detail.nutrition.calories, 'kcal'],
                      ['Protein', detail.nutrition.protein, 'g'],
                      ['Carbs', detail.nutrition.carbs, 'g'],
                      ['Fat', detail.nutrition.fat, 'g'],
                    ].map(([label, value, unit]) => (
                      value === undefined || value === null ? null : (
                        <div key={label} style={{ background: COLORS.paper, border: `1px solid ${COLORS.cardBorder}`, borderRadius: '4px', padding: '8px 12px', minWidth: '68px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '16px', color: COLORS.ink }}>{value}{unit === 'g' ? 'g' : ''}</div>
                          <div style={{ fontSize: '10px', color: COLORS.inkFaint, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                        </div>
                      )
                    ))}
                  </div>
                  <p style={{ fontSize: '11.5px', color: COLORS.inkFaint, fontStyle: 'italic', margin: '0 0 6px' }}>
                    Rough AI estimate, not a verified lab analysis.
                  </p>
                  <button
                    onClick={handleEstimateNutrition}
                    disabled={estimatingNutrition}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: estimatingNutrition ? COLORS.inkFaint : COLORS.rust, fontSize: '12px', fontWeight: 600, cursor: estimatingNutrition ? 'default' : 'pointer', padding: 0 }}
                  >
                    {estimatingNutrition ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    {estimatingNutrition ? 'Re-estimating…' : 'Re-estimate'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEstimateNutrition}
                  disabled={estimatingNutrition}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
                    border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px',
                    padding: '9px 16px', fontSize: '13px', fontWeight: 600, marginBottom: '18px',
                    cursor: estimatingNutrition ? 'default' : 'pointer', opacity: estimatingNutrition ? 0.75 : 1,
                  }}
                >
                  {estimatingNutrition ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {estimatingNutrition ? 'Estimating…' : 'Estimate nutrition'}
                </button>
              )}

              <h3 style={sectionHeader()}>Steps</h3>
              {detail.steps.length === 0 ? (
                <div style={{ background: COLORS.paper, border: `1px dashed ${COLORS.cardBorder}`, borderRadius: '4px', padding: '18px', marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: COLORS.inkFaint, margin: '0 0 12px' }}>
                    This recipe doesn't have instructions yet.
                  </p>
                  <button
                    onClick={generatingSteps ? undefined : handleGenerateSteps}
                    aria-disabled={generatingSteps}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', background: COLORS.sage, color: COLORS.cream,
                      border: 'none', borderRadius: '3px', padding: '9px 16px', fontSize: '13px', fontWeight: 600,
                      cursor: generatingSteps ? 'default' : 'pointer', opacity: generatingSteps ? 0.75 : 1,
                      pointerEvents: generatingSteps ? 'none' : 'auto',
                    }}
                  >
                    {generatingSteps ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {generatingSteps ? 'Writing steps…' : 'Suggest instructions'}
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  {detail.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < detail.steps.length - 1 ? `1px solid ${COLORS.paperDark}` : 'none' }}>
                      <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: COLORS.sage, color: COLORS.cream, fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: '14.5px', color: COLORS.ink, lineHeight: 1.55, margin: 0, paddingTop: '2px' }}>{s}</p>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={sectionHeader()}>Dietary swap</h3>
              <p style={{ fontSize: '12.5px', color: COLORS.inkFaint, margin: '0 0 10px', lineHeight: 1.45 }}>
                Get ingredient and step substitutions for a different diet — review and apply each one below, same as with note suggestions.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {[
                  ['vegetarian', 'Vegetarian'],
                  ['vegan', 'Vegan'],
                  ['gluten-free', 'Gluten-free'],
                  ['dairy-free', 'Dairy-free'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => runDietarySwap(key)}
                    disabled={suggestionsLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
                      border: `1px solid ${dietaryLoadingType === key ? COLORS.mustard : COLORS.cardBorder}`,
                      color: dietaryLoadingType === key ? COLORS.rustDark : COLORS.inkFaint,
                      borderRadius: '3px', padding: '7px 14px', fontSize: '12px', fontWeight: 600,
                      cursor: suggestionsLoading ? 'default' : 'pointer',
                      opacity: suggestionsLoading && dietaryLoadingType !== key ? 0.5 : 1,
                    }}
                  >
                    {dietaryLoadingType === key ? <Loader2 size={12} className="animate-spin" /> : <Leaf size={12} />}
                    {label}
                  </button>
                ))}
              </div>

              <h3 style={sectionHeader()}>Notes</h3>
              <textarea
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Tweaks you made, what worked, what you'd change next time…"
                style={{ ...inputStyle(), resize: 'vertical', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  onClick={saveNote}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {noteSaved ? <Check size={13} /> : null}
                  {noteSaved ? 'Saved' : 'Save note'}
                </button>
                <button
                  onClick={suggestChanges}
                  disabled={!noteDraft.trim() || suggestionsLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
                    border: `1px solid ${noteDraft.trim() ? COLORS.mustard : COLORS.cardBorder}`,
                    color: noteDraft.trim() ? COLORS.rustDark : COLORS.inkFaint, opacity: noteDraft.trim() ? 1 : 0.6,
                    borderRadius: '3px', padding: '7px 14px', fontSize: '12px', fontWeight: 600,
                    cursor: noteDraft.trim() && !suggestionsLoading ? 'pointer' : 'default',
                  }}
                >
                  <Sparkles size={13} /> Suggest a change
                </button>
              </div>

              {suggestionsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: COLORS.inkFaint, fontSize: '12.5px', marginBottom: '20px' }}>
                  <Loader2 size={13} className="animate-spin" /> {dietaryLoadingType ? `Checking for ${dietaryLoadingType} substitutions…` : 'Checking if this note suggests a change…'}
                </div>
              )}

              {suggestions.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  {suggestions.map((sug) => (
                    <div key={sug.id} style={{ background: COLORS.paperDark, border: `1px solid ${COLORS.mustard}`, borderRadius: '4px', padding: '12px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.rustDark, marginBottom: '8px' }}>
                        <Sparkles size={12} /> Suggested {sug.type === 'ingredient' ? 'ingredient' : 'step'} change
                      </div>
                      {sug.reason && (
                        <p style={{ fontSize: '12.5px', color: COLORS.inkFaint, margin: '0 0 8px', lineHeight: 1.45 }}>{sug.reason}</p>
                      )}
                      <div style={{ fontFamily: sug.type === 'ingredient' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif', fontSize: '13.5px', marginBottom: '10px' }}>
                        <div style={{ color: COLORS.inkFaint, textDecoration: 'line-through', marginBottom: '3px' }}>{sug.current}</div>
                        <div style={{ color: COLORS.ink, fontWeight: 600 }}>{sug.suggested}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {sug.applied ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: COLORS.sage, color: COLORS.cream, borderRadius: '3px', padding: '8px', fontSize: '13px', fontWeight: 600 }}>
                            <Check size={14} /> Done!
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => applySuggestion(sug)}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '3px', padding: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              <Check size={14} /> Apply
                            </button>
                            <button
                              onClick={() => dismissSuggestion(sug.id)}
                              style={{ background: 'none', border: `1px solid ${COLORS.cardBorder}`, color: COLORS.inkFaint, borderRadius: '3px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <button
                  onClick={() => setConfirmDialog({
                    title: 'Remove recipe?',
                    message: `"${detail.title || 'This recipe'}" will be permanently removed from your library.`,
                    confirmLabel: 'Remove',
                    danger: true,
                    onConfirm: () => { setConfirmDialog(null); handleDelete(detail.id); },
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.rust, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  <Trash2 size={14} /> Remove from library
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COOK MODE */}
      {view === 'cook' && detail && (
        <div style={{ minHeight: '100vh', background: COLORS.ink, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', paddingBottom: isMealCook ? '2px' : '16px' }}>
            <span style={{ color: COLORS.cream, opacity: 0.7, fontSize: '13px' }}>
              Step {cookStepIndex + 1} of {detail.steps.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => setVoiceMode((v) => !v)}
                title={voiceMode ? 'Turn off voice control' : 'Turn on voice control'}
                style={{ background: voiceMode ? COLORS.sage : 'none', border: voiceMode ? 'none' : '1px solid rgba(255,255,255,0.3)', color: COLORS.cream, cursor: 'pointer', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {voiceMode ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button onClick={exitCookMode} style={{ background: 'none', border: 'none', color: COLORS.cream, cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
          </div>
          {isMealCook && (
            <div style={{ padding: '0 16px 14px', textAlign: 'center' }}>
              <p style={{ color: COLORS.mustard, opacity: 0.9, fontSize: '13px', fontWeight: 600, margin: 0 }}>
                <Layers size={12} style={{ verticalAlign: '-1px', marginRight: '5px' }} />
                Combined meal: {detail.title}
              </p>
            </div>
          )}


          {voiceMode && (
            <div style={{ padding: '0 16px 14px', textAlign: 'center' }}>
              <p style={{ color: COLORS.cream, opacity: 0.55, fontSize: '11.5px', margin: 0 }}>
                {voiceStatus || 'Listening — say "next", "back", "repeat", "start timer", or "done"'}
              </p>
            </div>
          )}

          {(() => {
            const relevant = relevantIngredientsForStep(detail.steps[cookStepIndex] || '', detail.ingredients || []);
            if (relevant.length === 0) return null;
            return (
              <div style={{ padding: '0 16px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.mustard, marginBottom: '10px' }}>
                  <Utensils size={12} /> For this step
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: relevant.length > 1 ? '1fr 1fr' : '1fr', gap: '8px' }}>
                  {relevant.map((ing, i) => (
                    <CookIngredientChip key={i} text={scaleIngredientText(ing, scaleFactor)} />
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ textAlign: 'center', maxWidth: '480px' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '52px', fontWeight: 700, color: COLORS.mustard, marginBottom: '20px' }}>
                {cookStepIndex + 1}
              </div>
              <p style={{ color: COLORS.cream, fontSize: '22px', lineHeight: 1.5, fontFamily: 'Fraunces, serif' }}>
                {detail.steps[cookStepIndex]}
              </p>
            </div>
          </div>

          {timerInfo && (() => {
            const elapsed = timerInfo.upperSeconds - timerRemaining;
            const hasRange = timerInfo.lowerSeconds != null;
            const inReadyZone = hasRange && elapsed >= timerInfo.lowerSeconds && timerRemaining > 0;
            const isDone = timerRemaining === 0;
            const barColor = isDone ? COLORS.mustard : inReadyZone ? COLORS.sage : COLORS.rust;
            const progressPct = Math.min(100, (elapsed / timerInfo.upperSeconds) * 100);
            const thresholdPct = hasRange ? (timerInfo.lowerSeconds / timerInfo.upperSeconds) * 100 : null;
            let label;
            if (isDone) label = "Time's up";
            else if (inReadyZone) label = `Ready — up to ${formatMMSS(timerRemaining)} more if needed`;
            else if (hasRange) label = `At least ${formatMMSS(timerInfo.lowerSeconds - elapsed)} to go`;
            else label = timerRunning ? 'Counting down' : 'Ready to start';

            return (
              <div style={{ padding: '0 16px 20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
                  <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', margin: '10px 0 18px', overflow: 'visible' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: '3px',
                      width: `${progressPct}%`, background: barColor, transition: 'width 1s linear, background 0.4s ease',
                    }} />
                    {thresholdPct != null && (
                      <>
                        <div style={{
                          position: 'absolute', top: '-7px', left: `${thresholdPct}%`, width: '3px', height: '20px',
                          background: COLORS.mustard, transform: 'translateX(-1.5px)', borderRadius: '1.5px',
                          boxShadow: '0 0 6px rgba(201,138,44,0.85)',
                        }} />
                        <div style={{
                          position: 'absolute', top: '-13px', left: `${thresholdPct}%`, width: '8px', height: '8px',
                          borderRadius: '50%', background: COLORS.mustard, transform: 'translateX(-4px)',
                          boxShadow: '0 0 5px rgba(201,138,44,0.9)',
                        }} />
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '30px', fontWeight: 600, color: COLORS.cream, lineHeight: 1 }}>
                        {formatMMSS(timerRemaining)}
                      </div>
                      <div style={{ fontSize: '12px', color: isDone ? COLORS.mustard : inReadyZone ? COLORS.sage : 'rgba(255,253,248,0.6)', marginTop: '4px', fontWeight: inReadyZone || isDone ? 600 : 400 }}>
                        {label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => setTimerRunning((r) => !r)}
                        disabled={isDone}
                        style={{
                          width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                          background: isDone ? 'rgba(255,255,255,0.1)' : COLORS.rust, color: COLORS.cream,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isDone ? 'default' : 'pointer', opacity: isDone ? 0.4 : 1,
                        }}
                      >
                        {timerRunning ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                      </button>
                      <button
                        onClick={() => { setTimerRemaining(timerInfo.upperSeconds); setTimerRunning(false); }}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'none', color: COLORS.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '10px', padding: '16px' }}>
            <button
              onClick={() => setCookStepIndex((i) => Math.max(0, i - 1))}
              disabled={cookStepIndex === 0}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: cookStepIndex === 0 ? 'transparent' : COLORS.paperDark, opacity: cookStepIndex === 0 ? 0.3 : 1, color: COLORS.ink, border: 'none', borderRadius: '4px', padding: '14px', fontWeight: 600, cursor: cookStepIndex === 0 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={18} /> Back
            </button>
            {cookStepIndex < detail.steps.length - 1 ? (
              <button
                onClick={() => setCookStepIndex((i) => Math.min(detail.steps.length - 1, i + 1))}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.rust, color: COLORS.cream, border: 'none', borderRadius: '4px', padding: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Next <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={exitCookMode}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: COLORS.sage, color: COLORS.cream, border: 'none', borderRadius: '4px', padding: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Check size={18} /> Done
              </button>
            )}
          </div>
        </div>
      )}

      {importToast && (
        <div
          style={{
            position: 'fixed', bottom: '20px', left: '16px', right: '16px', maxWidth: '400px', margin: '0 auto',
            background: importToast.type === 'error' ? COLORS.rustDark : COLORS.sage, color: COLORS.cream,
            borderRadius: '4px', padding: '13px 16px', fontSize: '13.5px', fontWeight: 600,
            boxShadow: '0 3px 10px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 90,
          }}
        >
          {importToast.type === 'error' ? <AlertCircle size={16} style={{ flexShrink: 0 }} /> : <Check size={16} style={{ flexShrink: 0 }} />}
          {importToast.text}
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {galleryIndex !== null && detail && (() => {
        const galleryImages = detail.image ? [detail.image, ...getGalleryExtras(detail)] : getGalleryExtras(detail);
        if (galleryImages.length === 0) return null;
        return (
          <PhotoLightbox
            images={galleryImages}
            index={Math.min(galleryIndex, galleryImages.length - 1)}
            onIndexChange={setGalleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        );
      })()}
    </div>
  );
}
