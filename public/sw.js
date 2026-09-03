// App-shell service worker — enables installability (Android/Chrome + Capacitor TWA
// require an active service worker) and caches static assets for a faster repeat load.
// Deliberately does NOT cache API/entity calls, since balance and price data must
// always be fresh.
//
// The strategy is split by what the request is for, because using one strategy for
// everything was serving stale builds:
//
//   HTML  -> network first, cache as a fallback.
//   Assets -> cache first, since Vite content-hashes their filenames.
//
// This used to be `cached || network` for everything, index.html included. That
// meant a returning user was served the PREVIOUS build's index.html, which points
// at the previous build's hashed bundles — so a shipped fix could sit unseen
// through reload after reload while the deploy itself was live and correct. HTML is
// the one file whose URL never changes, so it is the one file that must not be
// answered from cache while the network is available.
//
// Hashed assets are the opposite case: their URL changes whenever their content
// does, so a cache hit is always correct and always current. That is where the
// speed actually comes from, and it costs nothing in freshness.
const CACHE = 'millionTSP-shell-v2';
const SHELL_ASSETS = ['/', '/manifest.json', '/tsp-shield-favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Renaming the cache above is what evicts every entry written by the old
  // cache-first strategy — otherwise a stale index.html would survive this fix.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(request, url) {
  return request.mode === 'navigate'
    || (request.headers.get('accept') || '').includes('text/html')
    || url.pathname === '/'
    || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GETs — never intercept API/backend calls.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/functions')) return;

  // The document itself: always ask the network, and keep a copy so the app still
  // opens offline. A failed fetch (offline, flaky signal) falls back to whatever
  // was last cached, and finally to the cached shell for a deep link that was
  // never visited online.
  if (isHtmlRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Everything else — hashed JS/CSS, icons, fonts. Serve from cache when present
  // and refresh in the background, so a changed file is picked up next time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
