const CACHE_NAME = 'dompetmungil-v2.0.0';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/print.css',
  '/js/main.js',
  '/js/api.js',
  '/js/store.js',
  '/js/icons.js',
  '/js/ghibli-scene.js',
  '/js/bank-parser.js',
  '/js/views/auth.js',
  '/js/views/dashboard.js',
  '/js/views/transactions.js',
  '/js/views/bank-import.js',
  '/js/views/planning.js',
  '/js/views/print-view.js',
  '/js/views/settings.js',
  '/js/views/tx-modal.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
