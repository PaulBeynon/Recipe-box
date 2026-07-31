// Service worker for offline support — caches the app shell (HTML/JS) so The Recipe Box can
// still open with no connectivity, e.g. patchy kitchen wifi mid-recipe. Recipe data itself is
// handled separately by Firestore's own offline persistence (enabled in firebase-init.js),
// not by this file.
//
// Strategy: network-first for same-origin app-shell requests, falling back to the cache only
// when the network is unavailable. That means online visits always get the latest deploy —
// no risk of a stuck-on-an-old-version bug — and offline visits fall back to whatever was
// last successfully loaded. Cross-origin requests (Firestore, Auth, the Cloud Function,
// Google Fonts, recipe photo URLs) are left alone entirely; the browser and Firestore's own
// caching already handle those.

const CACHE_VERSION = 'recipe-box-v1';
const APP_SHELL = ['./', './index.html', './bundle.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: let it pass through untouched

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
