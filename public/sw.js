// BNG Financial Maintenance - Service Worker
// Network-first strategy: serves fresh content when online, falls back to cache only when offline.
// Never cache-first dev/build JS or CSS chunks to avoid serving stale code.

const CACHE_NAME = 'bng-finance-v2';
const APP_SHELL = ['/', '/index.html'];

// Paths that must NEVER be served cache-first (always prefer network).
const NEVER_CACHE_FIRST = [
  '/src/',
  '/node_modules/.vite',
  '/@vite',
  '/@react-refresh',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin GET requests.
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isDevChunk = NEVER_CACHE_FIRST.some((p) => url.pathname.startsWith(p));
  const isJsOrCss = /\.(js|css|mjs)$/.test(url.pathname) || url.pathname.includes('?');

  // HTML navigations: network-first, fallback to cached index.html when offline.
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Dev chunks / JS / CSS: always go to network; only use cache if offline.
  if (isDevChunk || isJsOrCss) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Other static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
