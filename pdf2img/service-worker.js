const CACHE_PREFIX  = 'pdf2img';
const CACHE_VERSION = '2026-06-03-01';
const CACHE_NAME    = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
];

/* 外部CDNライブラリもオフラインキャッシュ */
const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

function cacheExternalResources(cache) {
  return Promise.allSettled(
    EXTERNAL_RESOURCES.map(url => {
      const req = new Request(url, { mode: 'no-cors' });
      return fetch(req).then(res => cache.put(req, res));
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => cacheExternalResources(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
