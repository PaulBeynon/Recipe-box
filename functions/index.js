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
