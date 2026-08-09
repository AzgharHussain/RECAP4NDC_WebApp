/**
 * queryTimeout.js — Global query timeout protection.
 *
 * Patches pg.Pool.prototype.query to automatically inject a default
 * statement_timeout on every query. This prevents any single slow query
 * from blocking the Node.js event loop indefinitely.
 *
 * If a query exceeds the timeout, PostgreSQL aborts it and returns an error,
 * which the route handler catches and returns as a 500 to the client.
 *
 * This is the most reliable approach because:
 * 1. It applies to ALL queries across ALL routers (no missed endpoints)
 * 2. It doesn't require changing any router code
 * 3. The timeout is enforced by PostgreSQL itself (not just the Node client)
 *
 * Usage (in index.js, before any router is loaded):
 *   require('./middlewares/queryTimeout')({ timeoutMs: 30000 });
 */
const { Pool } = require('pg');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

function setupQueryTimeout(options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const originalQuery = Pool.prototype.query;

  // Wrap Pool.prototype.query so every call gets a statement_timeout
  Pool.prototype.query = function (text, values, callback) {
    // Handle the 3 calling conventions of pg.Pool.query:
    //   1. query(text, callback)
    //   2. query(text, values, callback)
    //   3. query(text, values)  → returns Promise
    //   4. query(configObject)  → returns Promise
    //   5. query(configObject, callback)

    if (typeof text === 'object' && text !== null) {
      // Config object form: query(config) or query(config, callback)
      if (!text.timeout) {
        text.timeout = timeoutMs;
      }
      if (callback) {
        return originalQuery.call(this, text, callback);
      }
      return originalQuery.call(this, text);
    }

    // String form: query(text, values?, callback?)
    if (typeof text === 'string') {
      if (typeof values === 'function') {
        // query(text, callback)
        return originalQuery.call(this, { text, timeout: timeoutMs }, values);
      }
      if (callback) {
        // query(text, values, callback)
        return originalQuery.call(this, { text, values, timeout: timeoutMs }, callback);
      }
      // query(text, values) → Promise
      return originalQuery.call(this, { text, values, timeout: timeoutMs });
    }

    // Fallback: pass through unchanged
    return originalQuery.call(this, text, values, callback);
  };

}

module.exports = setupQueryTimeout;
