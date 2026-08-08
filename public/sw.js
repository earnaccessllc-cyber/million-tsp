// Minimal app-shell service worker — enables installability (Android/Chrome + Capacitor TWA
// require an active service worker) and caches static assets for a faster repeat load.
// Deliberately does NOT cache API/entity calls, since balance and price data must always be fresh.
const CACHE = 'millionTSP-shell-v1';
const SHELL_ASSETS = ['/', '/manifest.json', '/tsp-shield-favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only cache same-origin static assets — never intercept API/backend calls.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/functions')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});