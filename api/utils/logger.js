/**
 * logger.js — Centralized logging for the backend.
 *
 * All logs go to the console AND to files in the /logs folder:
 *   - logs/app.log      → all levels (info, warn, error)
 *   - logs/error.log     → errors only
 *   - logs/access.log    → HTTP request logs
 *
 * Log rotation: files are appended. Use logrotate or PM2's log management
 * in production to prevent unbounded growth.
 *
 * Usage:
 *   const { log, warn, error } = require('./utils/logger');
 *   log('Server started on port', PORT);
 *   warn('Deprecated endpoint used');
 *   error('Database connection failed', err);
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  // If we can't create the log dir, fall back to console-only
}

// Log file streams (append mode)
const appLogStream = (() => {
  try { return fs.createWriteStream(path.join(LOG_DIR, 'app.log'), { flags: 'a' }); }
  catch { return null; }
})();

const errorLogStream = (() => {
  try { return fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' }); }
  catch { return null; }
})();

// Format timestamp
function ts() {
  return new Date().toISOString();
}

// Format a log line
function formatLine(level, args) {
  const parts = args.map(a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  });
  return `[${ts()}] [${level}] ${parts.join(' ')}`;
}

// Write to file stream
function writeToFile(stream, line) {
  if (stream && !stream.destroyed) {
    stream.write(line + '\n');
  }
}

// Log levels
function log(...args) {
  const line = formatLine('INFO', args);
  console.log(line);
  writeToFile(appLogStream, line);
}

function warn(...args) {
  const line = formatLine('WARN', args);
  console.warn(line);
  writeToFile(appLogStream, line);
}

function error(...args) {
  const line = formatLine('ERROR', args);
  console.error(line);
  writeToFile(appLogStream, line);
  writeToFile(errorLogStream, line);
}

function debug(...args) {
  if (process.env.NODE_ENV === 'development') {
    const line = formatLine('DEBUG', args);
    console.debug(line);
    writeToFile(appLogStream, line);
  }
}

// HTTP access log (used by middleware)
function access(method, url, status, durationMs) {
  const line = `[${ts()}] [ACCESS] ${method} ${url} ${status} ${durationMs}ms`;
  writeToFile(appLogStream, line);
}

module.exports = { log, warn, error, debug, access };
