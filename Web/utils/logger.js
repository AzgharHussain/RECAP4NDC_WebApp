/**
 * logger.js — Centralized logging for the frontend.
 *
 * In production: logs are suppressed (console.log removed by terser).
 * In development: logs go to the browser console with levels.
 *
 * Usage:
 *   import { log, warn, error } from '../utils/logger';
 *   log('Patrol data loaded', data);
 *   warn('Deprecated API endpoint used');
 *   error('Failed to fetch user', err);
 */

const isDev = import.meta.env.DEV;

// No-op in production — terser also strips console.log via pure_funcs
const noop = () => {};

export const log = isDev ? (...args) => console.log('[INFO]', ...args) : noop;
export const warn = isDev ? (...args) => console.warn('[WARN]', ...args) : noop;
export const error = (...args) => console.error('[ERROR]', ...args);
export const debug = isDev ? (...args) => console.debug('[DEBUG]', ...args) : noop;

export default { log, warn, error, debug };
