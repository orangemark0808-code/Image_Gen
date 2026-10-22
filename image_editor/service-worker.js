// service-worker.js
// 画像エディター PWA - オフラインキャッシュ担当

// バージョン番号: HTMLや機能を更新した時はここを書き換えると古いキャッシュが破棄される
const CACHE_VERSION = '2026-10-23-01';
const CACHE_PREFIX = 'ohana-image-editor-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// キャッシュ対象のファイル（相対パス）
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
];

// インストール時: 必要なファイルをキャッシュに保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_FILES);
    }).then(() => self.skipWaiting())
  );
});

// 有効化時: 古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        // 接頭辞のない旧キャッシュは他アプリと区別できないため削除しない。
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時: キャッシュ優先、なければネットワークから取得して保存
self.addEventListener('fetch', (event) => {
  // GET以外はスルー
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAME }).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // 同一オリジンの成功レスポンスのみキャッシュ
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, responseClone)
          ));
        }
        return response;
      }).catch(() => {
        // オフライン時のフォールバック: index.htmlを返す
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html', { cacheName: CACHE_NAME });
        }
      });
    })
  );
});

