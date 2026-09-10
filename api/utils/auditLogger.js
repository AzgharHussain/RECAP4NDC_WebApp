const AuditLog = require('../models/AuditLog');
const Counter = require('../config/mongo').mongoose.model('AuditLogCounter');

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const THIRTY_SEVEN_DAYS_MS = 37 * 24 * 60 * 60 * 1000;

// ── Batching buffer ──────────────────────────────────────────────
// Instead of writing one AuditLog.create() per audit event (2 MongoDB
// round trips each: counter increment + insert), we buffer entries and
// flush them in batches. This dramatically reduces MongoDB load under
// high write traffic.

const FLUSH_INTERVAL_MS = 5000;   // flush every 5 seconds
const FLUSH_BATCH_SIZE = 100;     // or when 100 entries accumulate, whichever is first

let buffer = [];
let flushTimer = null;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  try {
    // Pre-allocate a contiguous block of logIds in a single counter round trip
    const count = batch.length;
    const counter = await Counter.findOneAndUpdate(
      { _id: 'auditLog' },
      { $inc: { seq: count } },
      { upsert: true, new: true }
    );
    const baseId = counter.seq - count; // first ID in this batch

    // Assign sequential logIds
    for (let i = 0; i < batch.length; i++) {
      batch[i].logId = baseId + i + 1;
    }

    await AuditLog.insertMany(batch, { ordered: false });
  } catch (err) {
    console.error('AuditLog batch write error:', err.message);
    // Re-buffer entries that failed (best-effort, avoid infinite growth)
    if (buffer.length < 500) {
      buffer = batch.concat(buffer);
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref(); // don't keep process alive just for flushing
}

// Flush on graceful shutdown so no entries are lost
process.on('SIGTERM', () => {
  flushBuffer().catch(() => {});
});

function logAudit(params) {
  const entry = {
    action: params.action,
    method: params.method || 'POST',
    endpoint: params.endpoint || '',
    status: params.status || 'SUCCESS',
    statusCode: params.statusCode || null,
    userId: params.userId || null,
    username: params.username || null,
    userRole: params.userRole || null,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    resourceType: params.resourceType || null,
    resourceId: params.resourceId ? String(params.resourceId) : null,
    details: params.details || null,
    errorMessage: params.errorMessage || null,
    retentionCategory: params.retentionCategory || 'SYSTEM_EVENT',
  };

  buffer.push(entry);

  // Flush immediately if batch is full, otherwise schedule a timed flush
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    flushBuffer().catch(() => {});
  } else {
    scheduleFlush();
  }
}

function logFromRequest(req, params) {
  // Mark the request so the global audit middleware knows a richer entry has
  // already been written and it shouldn't log a second generic one.
  if (req) req.auditLogged = true;

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
  const userAgent = req.headers['user-agent'] || null;
  const userId = req.user?.userId || req.user?.user_id || req.body?.user_id || null;
  const username = req.user?.username || req.body?.username || null;

  logAudit({
    ...params,
    userId: params.userId || userId,
    username: params.username || username,
    ipAddress: params.ipAddress || ip,
    userAgent: params.userAgent || userAgent,
    method: params.method || req.method,
    endpoint: params.endpoint || req.originalUrl || req.url,
  });
}

module.exports = { logAudit, logFromRequest, TWO_YEARS_MS, THIRTY_SEVEN_DAYS_MS, flushBuffer };
