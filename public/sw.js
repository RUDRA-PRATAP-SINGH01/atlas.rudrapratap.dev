/**
 * Atlas Platform Service Worker (PWA Offline Support)
 * 
 * Implements Stale-While-Revalidate caching strategy for HTML pages, WebP images,
 * CSS styles, and JS chunks to enable offline documentation and visual diagram viewing.
 */

const CACHE_NAME = "atlas-cache-v1";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/images/final-a.webp",
  "/images/atlas-logo.webp",
  "/images/PebbleDB-img.webp",
  "/images/Distributed-img.webp",
  "/images/decorative-cross.webp",
];

// Install Event: Pre-cache essential app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated cache buckets
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate caching strategy
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip browser extensions and third-party API origin requests
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts.g")) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails, cachedResponse will be served as fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
