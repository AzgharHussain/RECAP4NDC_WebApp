const { logFromRequest } = require('../utils/auditLogger');

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

const SKIP_PATHS = [
  '/api/test',
  '/api/test-post',
];

function shouldSkip(method, path) {
  if (!WRITE_METHODS.has(method)) return true;
  return SKIP_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

function inferAction(method, path) {
  if (path.includes('login') || path.includes('saveuser')) {
    return method === 'POST' ? 'LOGIN' : null;
  }
  if (path.includes('logout')) {
    return 'LOGOUT';
  }
  if (path.includes('changepassword')) {
    return 'PASSWORD_CHANGE';
  }
  if (path.includes('patrol-boundaries') && method === 'DELETE') {
    return 'BOUNDARY_DELETE';
  }
  if (path.includes('patrol-boundaries') && method === 'PUT') {
    return 'BOUNDARY_UPDATE';
  }
  if (path.includes('upload-patrol-boundary') || path.includes('upload-shp')) {
    return 'FILE_UPLOAD';
  }
  if (path.includes('patrol-post')) {
    return 'RECORD_CREATE';
  }
  if (path.includes('ndvi-change') && method === 'PUT') {
    return 'RECORD_UPDATE';
  }
  if (path.includes('ndvi-change') && method === 'DELETE') {
    return 'RECORD_DELETE';
  }
  if (path.includes('send-notifications')) {
    return 'NOTIFICATION_SUBSCRIBE';
  }
  if (path.includes('update-notification-user')) {
    return 'NOTIFICATION_UPDATE';
  }
  if (method === 'POST') return 'RECORD_CREATE';
  if (method === 'PUT') return 'RECORD_UPDATE';
  if (method === 'DELETE') return 'RECORD_DELETE';
  return 'API_ACCESS';
}

function inferResourceType(path) {
  if (path.includes('patrol-post') || path.includes('patrol-info')) return 'patrol';
  if (path.includes('ndvi-change')) return 'ndvi_record';
  if (path.includes('patrol-boundaries')) return 'patrol_boundary';
  if (path.includes('upload-shp') || path.includes('upload-patrol-boundary')) return 'gis_file';
  if (path.includes('notification')) return 'notification';
  if (path.includes('changepassword')) return 'admin_password';
  if (path.includes('saveuser') || path.includes('login')) return 'user_session';
  return null;
}

function auditMiddleware(req, res, next) {
  // Fast path: skip wrapping for GET requests (most traffic)
  if (shouldSkip(req.method, req.path)) {
    return next();
  }

  const originalSend = res.send.bind(res);

  res.send = function (body) {
    const status = res.statusCode >= 200 && res.statusCode < 300 ? 'SUCCESS' : res.statusCode >= 400 ? 'FAILED' : 'SUCCESS';
    const action = inferAction(req.method, req.originalUrl);
    const resourceType = inferResourceType(req.originalUrl);

    if (action) {
      let errorMessage = null;
      if (status === 'FAILED') {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          errorMessage = parsed?.error || parsed?.message || null;
        } catch {
          errorMessage = null;
        }
      }

      // Fire-and-forget — don't block the response
      setImmediate(() => {
        logFromRequest(req, {
          action: status === 'FAILED' && action === 'LOGIN' ? 'LOGIN_FAILED' : action,
          status,
          statusCode: res.statusCode,
          resourceType,
          resourceId: req.params?.id || null,
          errorMessage,
          retentionCategory: 'SYSTEM_EVENT',
        });
      });
    }

    return originalSend(body);
  };

  next();
}

module.exports = auditMiddleware;
