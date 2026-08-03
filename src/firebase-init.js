import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc, updateDoc, query, where, onSnapshot,
} from 'firebase/firestore';

// Public client config — safe to ship in the bundle. Real protection comes from
// the Firestore security rules (each user can only read/write their own uid path)
// and from the Cloud Function verifying the caller's Firebase ID token.
const firebaseConfig = {
  apiKey: "AIzaSyBPOaD_R5wXxHXELJXVTNpA63UkKq6OJIw",
  authDomain: "recipe-box-80ec6.firebaseapp.com",
  projectId: "recipe-box-80ec6",
  storageBucket: "recipe-box-80ec6.firebasestorage.app",
  messagingSenderId: "9856364814",
  appId: "1:9856364814:web:190ed6de77fc7de8c4a75f",
  measurementId: "G-CZZD7D0JVM",
};

// The predictable 1st-gen Cloud Function URL for the region/project below.
// If you ever redeploy under a different region or function name, update this.
export const CLOUD_FUNCTION_URL = 'https://europe-west2-recipe-box-80ec6.cloudfunctions.net/claudeProxy';
export const FETCH_PAGE_IMAGE_URL = 'https://europe-west2-recipe-box-80ec6.cloudfunctions.net/fetchPageImage';
export const EXTRACT_VIDEO_TEXT_URL = 'https://europe-west2-recipe-box-80ec6.cloudfunctions.net/extractVideoText';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// persistentLocalCache backs Firestore with IndexedDB so previously-loaded data (recipes,
// shopping list, meal plan) stays readable offline, and any writes made offline queue up and
// sync automatically once connectivity returns. persistentMultipleTabManager (rather than the
// single-tab variant) avoids needing to acquire an exclusive lock — that's a safer choice
// around a Google sign-in redirect, which tears the page down and reloads it from scratch;
// an exclusive-lock manager has more ways to contend with itself across that reload. If
// persistence setup fails for any reason (unsupported browser, storage restrictions, or
// anything else), fall back to a plain in-memory Firestore instance instead — offline support
// is a nice-to-have and should never be able to take anything else (like sign-in) down with it.
export let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  console.warn('Firestore offline persistence unavailable, falling back to in-memory:', err);
  db = getFirestore(app);
}
const googleProvider = new GoogleAuthProvider();

// Set right before navigating away for a redirect sign-in, cleared once we're back — lets
// App.jsx tell the difference between "nobody's tried to sign in yet" and "we just came back
// from a redirect attempt with nothing to show for it" (a known Firebase issue: some browsers
// — Chrome among them, depending on third-party storage settings — block the cross-origin
// storage access signInWithRedirect's default authDomain relies on, and getRedirectResult()
// then just quietly resolves to null with no error at all). See:
// https://firebase.google.com/docs/auth/web/redirect-best-practices
export const REDIRECT_PENDING_KEY = 'recipeBoxRedirectPending';

export function signInWithGoogle() {
  sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
  return signInWithRedirect(auth, googleProvider);
}

// Fallback for browsers where the redirect flow silently fails (see above) — popup-based
// sign-in doesn't depend on that same cross-origin storage relay, so it isn't affected by the
// same restriction. Kept as a fallback rather than the default because popup has its own
// failure modes on other browsers (that's exactly why this app used redirect in the first
// place), so the two methods cover each other's weak spots instead of one replacing the other.
export function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export function checkRedirectResult() {
  return getRedirectResult(auth);
}

// Email/password — a second sign-in option for anyone without (or not wanting to use) a
// Google account. Needs the "Email/Password" provider turned on in the Firebase Console under
// Authentication → Sign-in method, or these will fail with auth/operation-not-allowed.
export function createAccountWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function resetPasswordForEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

export function signOutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- Firestore-backed replacement for the artifact sandbox's window.storage ----------
// Same get/set/delete/list shape the app already expects, scoped under the signed-in
// user's own uid so it lines up with the security rules (users/{uid}/{document=**}).
// Each "key" (e.g. "recipe-index", "recipe-full:abc123") becomes one Firestore document
// in a single flat collection per user, storing the raw string value the app already reads/writes.

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}

function docKeyToId(key) {
  // Firestore doc IDs can't contain "/" — the app's keys use ":" as a separator already,
  // so no collision risk, but guard against forward slashes just in case.
  return key.replace(/\//g, '__');
}

export function installFirestoreStorageShim() {
  window.storage = {
    async get(key, _shared) {
      const uid = requireUid();
      const ref = doc(db, 'users', uid, 'items', docKeyToId(key));
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Key not found: ${key}`);
      const data = snap.data();
      return { key, value: data.value, shared: false };
    },
    async set(key, value, _shared) {
      const uid = requireUid();
      const ref = doc(db, 'users', uid, 'items', docKeyToId(key));
      await setDoc(ref, { key, value, updatedAt: Date.now() });
      return { key, value, shared: false };
    },
    async delete(key, _shared) {
      const uid = requireUid();
      const ref = doc(db, 'users', uid, 'items', docKeyToId(key));
      await deleteDoc(ref);
      return { key, deleted: true, shared: false };
    },
    async list(prefix, _shared) {
      const uid = requireUid();
      const colRef = collection(db, 'users', uid, 'items');
      const snap = await getDocs(colRef);
      const keys = [];
      snap.forEach((d) => {
        const k = d.data().key;
        if (!prefix || (k && k.startsWith(prefix))) keys.push(k);
      });
      return { keys, prefix, shared: false };
    },
  };
}

// ---------- Friends & recipe sharing ----------
// A deliberately small, top-level data model, separate from the users/{uid}/items/* space above
// (which stays fully private). Three top-level collections:
//   friendCodes/{code}      — public code -> uid lookup, so "add a friend" works from a shareable
//                              code/link without either party needing to know the other's email.
//   friendRequests/{pairId} — one doc per pair (id = the two uids, sorted, joined by "_"), so
//                              "are these two people friends" is a single cheap get() both in the
//                              client and inside the security rules for sharedRecipes below.
//   sharedRecipes/{id}      — one doc per recipe sent from one friend to another, with its own
//                              accept/decline status; accepting copies it into the recipient's own
//                              library client-side, this doc is just the in-transit envelope.
// publicProfiles/{uid} exists purely so a friend's display name can be shown somewhere other than
// their raw uid — nothing else about a user is ever exposed here.

function requireUid_() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}

// Deterministic id for a pair of uids, order-independent — same id however you look it up.
function pairId(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — easy to read aloud/type

function randomFriendCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)];
  return code;
}

// Keeps this user's own display name visible to friends (nowhere else). Cheap to call on every
// sign-in — it's a single small doc write, and skips the write entirely if nothing's changed.
export async function upsertPublicProfile() {
  const uid = requireUid_();
  const name = (auth.currentUser?.displayName || auth.currentUser?.email || 'A Recipeasypeasy user').slice(0, 60);
  const ref = doc(db, 'publicProfiles', uid);
  const existing = await getDoc(ref).catch(() => null);
  if (existing && existing.exists() && existing.data().displayName === name) return;
  await setDoc(ref, { displayName: name, updatedAt: Date.now() });
}

export async function getPublicProfile(uid) {
  const snap = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
  return snap && snap.exists() ? snap.data() : { displayName: 'A Recipeasypeasy user' };
}

// Returns this user's existing invite code, generating one the first time it's needed. Cached
// under their own private items so opening the invite screen repeatedly doesn't mint a fresh
// (and now-broken) code every time.
export async function getOrCreateMyFriendCode() {
  const uid = requireUid_();
  const cacheRef = doc(db, 'users', uid, 'items', 'friend-code');
  const cached = await getDoc(cacheRef).catch(() => null);
  if (cached && cached.exists()) return cached.data().value;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomFriendCode();
    const codeRef = doc(db, 'friendCodes', code);
    const clash = await getDoc(codeRef).catch(() => null);
    if (clash && clash.exists()) continue; // extremely unlikely, but retry on collision
    await setDoc(codeRef, { uid, createdAt: Date.now() });
    await setDoc(cacheRef, { key: 'friend-code', value: code, updatedAt: Date.now() });
    return code;
  }
  throw new Error('Could not generate an invite code right now — please try again.');
}

// Resolves a friend's invite code to their uid, or null if the code doesn't exist.
export async function resolveFriendCode(rawCode) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const snap = await getDoc(doc(db, 'friendCodes', code)).catch(() => null);
  return snap && snap.exists() ? snap.data().uid : null;
}

export async function sendFriendRequest(toUid) {
  const uid = requireUid_();
  if (toUid === uid) throw new Error('SELF: You can\u2019t add yourself as a friend.');
  const ref = doc(db, 'friendRequests', pairId(uid, toUid));
  const existing = await getDoc(ref).catch(() => null);
  if (existing && existing.exists()) {
    const status = existing.data().status;
    if (status === 'accepted') throw new Error('ALREADY: You\u2019re already friends.');
    if (status === 'pending') throw new Error('PENDING: There\u2019s already a pending request between you two.');
  }
  await setDoc(ref, { fromUid: uid, toUid, status: 'pending', createdAt: Date.now(), updatedAt: Date.now() });
}

export async function respondToFriendRequest(otherUid, accept) {
  const uid = requireUid_();
  await updateDoc(doc(db, 'friendRequests', pairId(uid, otherUid)), {
    status: accept ? 'accepted' : 'declined',
    updatedAt: Date.now(),
  });
}

export async function removeFriend(otherUid) {
  const uid = requireUid_();
  await deleteDoc(doc(db, 'friendRequests', pairId(uid, otherUid)));
}

// Live-subscribes to every friendRequests doc involving me, from both possible query
// directions (I might be fromUid or toUid on any given doc — Firestore can't OR across two
// different fields in one query, so this runs two listeners and merges their results).
export function watchFriendRequests(callback) {
  const uid = requireUid_();
  const state = { asFrom: [], asTo: [] };
  const emit = () => {
    const merged = [...state.asFrom, ...state.asTo];
    callback(merged);
  };
  const unsub1 = onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', uid)), (snap) => {
    state.asFrom = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  const unsub2 = onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid)), (snap) => {
    state.asTo = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  return () => { unsub1(); unsub2(); };
}

// recipeData should be a small plain object (title/servings/time/ingredients/steps/tags) — kept
// deliberately text-only, no image data, so a shared-recipe doc stays tiny regardless of how
// large the sender's original photos were.
export async function shareRecipeWithFriend(toUid, recipeData) {
  const uid = requireUid_();
  const { displayName } = await getPublicProfile(uid);
  await addDoc(collection(db, 'sharedRecipes'), {
    fromUid: uid,
    fromName: displayName,
    toUid,
    recipe: recipeData,
    status: 'pending',
    sentAt: Date.now(),
  });
}

export function watchIncomingShares(callback) {
  const uid = requireUid_();
  return onSnapshot(
    query(collection(db, 'sharedRecipes'), where('toUid', '==', uid), where('status', '==', 'pending')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export async function respondToSharedRecipe(shareId, accept) {
  await updateDoc(doc(db, 'sharedRecipes', shareId), { status: accept ? 'accepted' : 'declined' });
}
