/**
 * sw.js — Service Worker for offline caching and faster repeat loads.
 *
 * Strategy:
 *   - Static assets (JS, CSS, fonts, images): Cache First (instant load)
 *   - API requests: Network First (fresh data, fallback to cache if offline)
 *   - index.html: Network First (always get latest asset references)
 *
 * This dramatically reduces server load for 50000 users because:
 *   1. Repeat visits load from cache — zero server requests for assets
 *   2. Only API calls hit the server (and those are deduped by apiClient)
 *   3. Users can continue working during brief network outages
 */

const CACHE_VERSION = 'recap4ndc-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install (critical path for first render)
const PRE_CACHE_URLS = [
  '/',
  '/index.html',
];

// --- Install: pre-cache critical files ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('recap4ndc-') && key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// --- Fetch: route requests to appropriate caching strategy ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (geoserver, forest proxy) — let browser handle
  if (url.origin !== self.location.origin) return;

  // --- API requests: Network First with cache fallback ---
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses (but not errors)
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              // Only cache GET API responses for 5 minutes
              cache.put(request, clone);
              // Auto-expire after 5 minutes
              setTimeout(() => cache.delete(request), 5 * 60 * 1000);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed — try cache
          return caches.match(request);
        })
    );
    return;
  }

  // --- Static assets: Cache First ---
  // Vite outputs hashed filenames, so cached versions are always valid
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // --- HTML pages: Network First (get latest asset references) ---
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }
});
