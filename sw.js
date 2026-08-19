// Bump this on every deploy that changes cached files — it's what makes the
// old cache get thrown away in `activate` below. If you forget, static
// assets (icons/manifest) may lag behind until you bump it next time; the
// HTML itself no longer depends on this since it's network-first (see fetch
// handler), so forgetting to bump won't cause the "stuck on old data" bug
// you hit before.
const CACHE_NAME = "jnu-bus-cache-v2";

const ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const isHTML =
    req.mode === "navigate" ||
    req.destination === "document" ||
    req.url.endsWith("/") ||
    req.url.endsWith(".html");

  if (isHTML) {
    // Network-first: always try to fetch the latest page. Only fall back to
    // whatever's cached if the network request fails (e.g. offline). This
    // is what stops deleted/changed content from getting stuck forever.
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets (icons, manifest): cache-first for speed/offline use, but
  // refresh the cache in the background so they don't go stale forever.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
