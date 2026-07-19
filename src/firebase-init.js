import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, deleteDoc, collection, getDocs,
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

export function signInWithGoogle() {
  return signInWithRedirect(auth, googleProvider);
}

export function checkRedirectResult() {
  return getRedirectResult(auth);
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
