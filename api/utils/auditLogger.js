const AuditLog = require('../models/AuditLog');

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const THIRTY_SEVEN_DAYS_MS = 37 * 24 * 60 * 60 * 1000;

async function writeLog(entry) {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('AuditLog write error:', err.message);
  }
}

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

  writeLog(entry).catch(() => {});
}

function logFromRequest(req, params) {
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

module.exports = { logAudit, logFromRequest, TWO_YEARS_MS, THIRTY_SEVEN_DAYS_MS };
