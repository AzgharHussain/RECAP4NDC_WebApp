/**
 * apiCache.js — Lightweight in-memory LRU cache for GET endpoints.
 *
 * For 1M users, dropdown/reference data (divisions, ranges, beats, coupe
 * hierarchies) is read far more often than it changes. Caching these for
 * 60 seconds eliminates 90%+ of DB queries for those endpoints.
 *
 * Usage:
 *   const { cacheMiddleware } = require('./middlewares/apiCache');
 *   router.get('/divisions', cacheMiddleware(60), handler);  // cache for 60s
 *
 * The cache key is based on the route path + query string + auth user ID
 * (so different users don't get each other's cached data).
 */

// Simple Map-based LRU cache with TTL
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.timers.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      const oldTimer = this.timers.get(oldestKey);
      if (oldTimer) {
        clearTimeout(oldTimer);
        this.timers.delete(oldestKey);
      }
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });

    // Auto-cleanup timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);
    timer.unref();
    this.timers.set(key, timer);
  }

  clear() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.cache.clear();
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance — shared across all requests in this worker
const globalCache = new LRUCache(Number(process.env.API_CACHE_MAX_SIZE) || 500);

/**
 * Express middleware that caches GET responses.
 * @param {number} ttlSeconds — how long to cache (default 60s)
 */
function cacheMiddleware(ttlSeconds = 60) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    // Build cache key: path + query + user ID (if authenticated)
    const userId = req.user?.userId || req.user?.user_id || 'anon';
    const queryStr = JSON.stringify(req.query || {});
    const cacheKey = `${req.originalUrl}|user=${userId}|q=${queryStr}`;

    const cached = globalCache.get(cacheKey);
    if (cached !== undefined) {
      // Cache hit — send immediately
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Cache miss — intercept res.json to store the result
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        globalCache.set(cacheKey, data, ttlSeconds);
        res.set('X-Cache', 'MISS');
      }
      return originalJson(data);
    };

    next();
  };
}

// Allow manual cache clearing (e.g., after data updates)
function clearCache() {
  globalCache.clear();
}

function getCacheSize() {
  return globalCache.size();
}

module.exports = { cacheMiddleware, clearCache, getCacheSize, LRUCache };
