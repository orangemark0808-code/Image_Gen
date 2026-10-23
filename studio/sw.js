const CACHE_PREFIX = 'ohana-studio-';
const CACHE_NAME = CACHE_PREFIX + '2026-10-23-04';

// キャッシュする統合UI本体のアセット
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 別オリジンのiframeコンテンツはキャッシュしない（そのまま通す）
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // ページはネットワーク優先で更新し、オフライン時だけ保存済みページを使う。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(async response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      }).catch(async () =>
        (await caches.match(event.request, { cacheName: CACHE_NAME })) ||
        caches.match('./index.html', { cacheName: CACHE_NAME })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAME }).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 正常レスポンスのみキャッシュ
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache)));
        return response;
      });
    })
  );
});

