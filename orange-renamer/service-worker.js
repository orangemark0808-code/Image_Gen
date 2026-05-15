const CACHE_PREFIX = "orange-renamer";
const CACHE_NAME = `${CACHE_PREFIX}-v1.0.0`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./terms_limited.txt",
  "./terms_standard.txt",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png"
];

function cacheKeyFor(request) {
  const url = new URL(request.url);
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith("/terms_limited.txt") || url.pathname.endsWith("/terms_standard.txt"))
  ) {
    return new Request(url.origin + url.pathname, request);
  }
  return request;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const cacheKey = cacheKeyFor(event.request);

  event.respondWith(
    caches.match(cacheKey).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return caches.match(cacheKey);
      });
    })
  );
});
