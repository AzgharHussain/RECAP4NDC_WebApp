// app.js or index.js

// ==================== GLOBAL CRASH PROTECTION ==================== //
// Without these handlers, a single unhandled error/rejection in ANY
// route anywhere in the app will crash the entire Node process,
// forcibly closing every open connection (seen by clients as ECONNRESET).
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('[DEBUG] After dotenv');
// === Global query timeout — must be loaded BEFORE any router ===
// Patches pg.Pool.prototype.query so every DB query across ALL routers
// gets a 30-second statement_timeout. Prevents slow queries from blocking
// the event loop and making the server unreachable.
const setupQueryTimeout = require('./middlewares/queryTimeout');
console.log('[DEBUG] Required queryTimeout');
setupQueryTimeout({ timeoutMs: 30000 });
console.log('[DEBUG] Executed setupQueryTimeout');

console.log('[DEBUG] Required middlewares');
const validateAlphaNumSpaceUnderscore = require("./middlewares/validateAlphaNumSpaceUnderscore");
const { verifyJwt } = require("./middlewares/verifyJwt");
console.log('[DEBUG] Requiring database.js');
const { sequelize, testConnection } = require('./config/database');
console.log('[DEBUG] Requiring mongo.js');
const { connectMongo } = require('./config/mongo');
console.log('[DEBUG] Requiring bcrypt');
const bcrypt = require('bcrypt');
console.log('[DEBUG] Requiring cacheControl');
const setNoCacheHeaders = require('./middlewares/cacheControl');
console.log('[DEBUG] Requiring firebase-admin');
const admin = require("firebase-admin");
console.log('[DEBUG] Requiring errorHandler');
const errorHandler = require("./middlewares/errorHandler");
console.log('[DEBUG] Requiring joi');
const Joi = require("joi");
// At top of server.js
console.log('[DEBUG] Requiring tokenBlacklist');
const blacklistedTokens = require("./middlewares/tokenBlacklist");
console.log('[DEBUG] Requiring helmet');
const helmet = require("helmet");
console.log('[DEBUG] Requiring crypto');
const crypto = require('crypto');
console.log('[DEBUG] Requiring rate-limit');
const rateLimit = require("express-rate-limit");
console.log('[DEBUG] Requiring forest-login');
const forestRoutes = require("./routers/forest-login");
console.log('[DEBUG] Done requiring other deps');
const auditMiddleware = require("./middlewares/auditMiddleware");
const auditLogsRouter = require("./routers/auditLogs");
const { logFromRequest } = require("./utils/auditLogger");
const app = express();
app.set('trust proxy', 1);
console.log('[DEBUG] Requiring ndviNotificationScheduler');
const startNdviScheduler = require("./scheduler/ndviNotificationScheduler");
console.log('[DEBUG] Requiring dataRetentionScheduler');
const startDataRetentionScheduler = require("./scheduler/dataRetentionScheduler");
console.log('[DEBUG] Schedulers required');


// ----------------------------------------------------
// 1. Initialize Firebase Admin SDK
// ----------------------------------------------------


// Strict Express settings
app.set('query parser', 'simple');
app.set('x-powered-by', false);
app.set('etag', false);

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(setNoCacheHeaders);
app.use(auditMiddleware);

// ✅ Explicitly set all required headers
// In app.js, enhance your Helmet configuration

// ================= SECURITY HEADERS ================= //


app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
app.use(compression({ threshold: 256, level: 6 }));
/* Content Security Policy */
// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'"],
//       styleSrc: ["'self'", "https:"],
//       imgSrc: ["'self'", "data:", "https:"],
//       connectSrc: ["'self'"],
//       fontSrc: ["'self'", "https:", "data:"],
//       objectSrc: ["'none'"],
//       upgradeInsecureRequests: [],
//     },
//   })
// );

/* Permissions Policy */
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  next();
});

// ✅ Your routes AFTER middleware
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/build/index.html");
});







// ==================== MIDDLEWARE ==================== //

const validateHttpHeaders = require('./middlewares/validateHttpHeaders');

// === Global API rate limiter — tuned for 1M concurrent users ===
// 5000 requests per minute per IP is generous enough for a busy office
// (many users behind one NAT IP) while still mitigating flood attacks.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5000,                 // 5000 requests/min per IP (supports large NAT offices)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please slow down." },
  // Skip rate limiting for health checks and OPTIONS preflight
  skip: (req) => req.method === 'OPTIONS' || req.path === '/api/test' || req.path === '/api/health',
});
app.use('/api', apiLimiter);

// === Stricter rate limiter for auth endpoints — prevents brute force ===
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 50,                   // 50 auth attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Please try again later." },
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/admin', authLimiter);

app.use('/api', validateHttpHeaders);
app.use('/api', validateAlphaNumSpaceUnderscore);
const validateNoDuplicateParams = (req, res, next) => {
  // Check for duplicate keys in body
  if (req.body && typeof req.body === 'object') {
    const keys = Object.keys(req.body);
    const uniqueKeys = new Set(keys);
    
    if (keys.length !== uniqueKeys.size) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate parameters not allowed'
      });
    }
  }
  
  // Check for parameters in both body and query
  if (req.query && req.body) {
    for (const key in req.query) {
      if (req.body[key] !== undefined) {
        return res.status(400).json({
          success: false,
          error: `Parameter '${key}' cannot be in both body and query`
        });
      }
    }
  }
  
  next();
};

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  // Production origins
  'https://gisfy.co.in:8445',
  'https://gisfy.co.in:8445/geoserver/wms',
  'https://forestrecap.gisfy.co.in',
  'https://fmps.gujarat.gov.in',
  'https://fmps.gujarat.gov.in:8080',
  // Localhost origins — safe to always include (not reachable externally in prod)
  'http://localhost:5002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5002',
  // Additional origins from env
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}));

// Parse cookies — needed for cookie-based auth fallback
app.use(cookieParser());



// Use express built-in JSON parser — 2MB limit for normal API requests
// (file uploads go through multer, not JSON parser)
app.use(express.json({
  limit: '2mb',
  type: ['application/json', 'application/*+json']
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logger
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
  });
  next();
});

// In your Express app (index.js), when setting cookies:
app.use((req, res, next) => {
    // Ensure all cookies have secure flags.
    // In development (HTTP), secure:true would prevent cookies from being set.
    const isProd = process.env.NODE_ENV === 'production';
    const originalCookie = res.cookie;
    res.cookie = function(name, value, options = {}) {
        const secureOptions = {
            secure: isProd,         // Only HTTPS in production
            httpOnly: true,         // Prevent JavaScript access
            sameSite: isProd ? 'strict' : 'lax',  // Lax in dev for cross-origin testing
            ...options
        };
        return originalCookie.call(this, name, value, secureOptions);
    };
    next();
});

// NOTE: Global response sanitization removed for performance.
// Per-field sanitization via clean() (xss) in route handlers handles XSS
// where needed. The global middleware was double-sanitizing every response
// (recursive walk + HTML entity escaping on ALL string fields), which
// blocked the event loop and corrupted JSON data values (e.g. O'Brien).
// Input-side validation (validateAlphaNumSpaceUnderscore, Joi) remains.

// ==================== FILE STORAGE ==================== //
const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');

[patrolImageDir, incidentImageDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const staticImageOptions = {
  fallthrough: false,
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=604800, immutable' : 'no-store');
  },
};

app.use('/Patrolimage', express.static(patrolImageDir, staticImageOptions));
app.use('/Incidentimage', express.static(incidentImageDir, staticImageOptions));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.startsWith('patrol_images')) {
      cb(null, patrolImageDir);
    } else {
      cb(null, incidentImageDir);
    }
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomUUID()}${safeExt}`);
  }
});

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image uploads are allowed'));
  }
});

// ==================== JWT CONFIG ==================== //
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
}


// Routers
const patrolRoutes = require('./routers/patrolRoutes');
const dropdownapis = require('./routers/dropdownapis');
const NdviRouter = require('./routers/ndviRouter');
const notifications = require('./routers/notifications');
const userlocations = require('./routers/userlocations');
const changendvi = require('./routers/changendvi');
const beat_patrol_coverage = require('./routers/beat-patrol-coverage');
const gisupload = require('./routers/gisupload');
const gisupload1 = require('./routers/gis-upload1');
const forestLoginRoutes = require('./routers/forestLogin');
const supportRouter = require('./routers/support');
const incidentLogsRouter = require('./routers/incidentLogs');
const incidentCategoriesRouter = require('./routers/incidentCategories');
const incidentSeverityRouter = require('./routers/incidentSeverity');
const ndviChangesRouter = require('./routers/ndviChanges');

const TEMP_SAVEUSER_TOKEN = process.env.TEMP_SAVEUSER_TOKEN || require('crypto').randomBytes(32).toString('hex');
const verifyTempToken = (req, res, next) => {
  const token = req.headers["x-temp-token"];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Temporary security token missing"
    });
  }

  if (token !== TEMP_SAVEUSER_TOKEN) {
    return res.status(403).json({
      success: false,
      error: "Invalid temporary security token"
    });
  }

  next();
};




// ==================== ROUTES ==================== //

// === Health check endpoint for load balancers / PM2 / Docker ===
// Returns 200 if the server is healthy, 503 if not.
// Checks: event loop lag, DB connection, memory usage.
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    eventLoopLag: null,
    database: 'unknown',
  };

  // Check event loop lag using the monitor's getCurrentLag function
  if (req.app.locals.getEventLoopLag) {
    try {
      const lag = await req.app.locals.getEventLoopLag();
      health.eventLoopLag = lag + 'ms';
      if (lag > 5000) {
        health.status = 'degraded';
      }
    } catch {}
  }

  // Check database connectivity
  try {
    await sequelize.authenticate();
    health.database = 'connected';
  } catch (e) {
    health.database = 'disconnected';
    health.status = 'unhealthy';
    health.databaseError = e.message;
  }

  // Check memory — if heap > 1.5GB, mark as degraded
  const heapMB = process.memoryUsage().heapUsed / 1024 / 1024;
  if (heapMB > 1500) {
    health.status = 'degraded';
  }

  const httpStatus = health.status === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(health);
});

// Test GET endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Test route works!' });
});

// Cache stats endpoint (admin/debug)
const { getCacheSize, clearCache } = require('./middlewares/apiCache');
app.get('/api/cache-stats', verifyJwt, (req, res) => {
  res.json({ success: true, cacheSize: getCacheSize() });
});
app.delete('/api/cache-stats', verifyJwt, (req, res) => {
  clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

// Test POST endpoint to verify body parsing
app.post('/api/test-post', (req, res) => {
  res.json({ 
    success: true, 
    message: 'POST test route works!',
    receivedBody: req.body 
  });
});




const allowedParams = ["username", "password"];

function validateNoDuplicateParams22(req, res, next) {

  try {

    // Reject credentials in query parameters
    if (req.query.username || req.query.password) {
      return res.status(400).json({
        success: false,
        error: "Credentials must be sent in request body only"
      });
    }

    // Reject unexpected parameters
    const bodyKeys = Object.keys(req.body);

    const unexpectedParams = bodyKeys.filter(
      key => !allowedParams.includes(key)
    );

    if (unexpectedParams.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unexpected parameters: ${unexpectedParams.join(", ")}`
      });
    }

    next();

  } catch (error) {

    return res.status(400).json({
      success: false,
      error: "Malformed request"
    });

  }
}
try {
  const serviceAccount = require("./routers/recap4ndc-add07-firebase-adminsdk-fbsvc-a7d6b597e7.json");

  // Validate the service account key has required fields
  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    console.error("❌ Firebase service account key is missing required fields (private_key or client_email).");
    console.error("   Generate a new key at: https://console.firebase.google.com/project/recap4ndc-add07/settings/serviceaccounts/adminsdk");
  } else if (!admin.apps.length) {
    // Temporarily clear proxy env vars so google-auth-library can reach
    // https://www.googleapis.com directly (bypassing corporate proxy that
    // times out with ETIMEDOUT 10.10.2.248:8080).
    const savedProxyVars = {};
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
      if (process.env[key]) {
        savedProxyVars[key] = process.env[key];
        delete process.env[key];
      }
    }

    // Permanently add googleapis.com to NO_PROXY so token refreshes
    // also bypass the proxy (google-auth-library checks NO_PROXY).
    const googleHosts = 'googleapis.com,www.googleapis.com,oauth2.googleapis.com,firestore.googleapis.com,fcm.googleapis.com';
    process.env.NO_PROXY = process.env.NO_PROXY
      ? `${process.env.NO_PROXY},${googleHosts}`
      : googleHosts;
    process.env.no_proxy = process.env.NO_PROXY;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    // Restore proxy env vars after Firebase init
    Object.assign(process.env, savedProxyVars);
  }
} catch (err) {
  console.error("❌ Firebase initialization failed:", err.message);
  console.error("   If 'Invalid JWT Signature', the service account key may be revoked.");
  console.error("   Generate a new key at: https://console.firebase.google.com/project/recap4ndc-add07/settings/serviceaccounts/adminsdk");
  console.error("   Save it as: api/routers/recap4ndc-add07-firebase-adminsdk-fbsvc-a7d6b597e7.json");
}

// Only run schedulers on the first worker in cluster mode to avoid
// 8× duplicate execution. In single-process mode (no cluster), always run.
const isPrimaryWorker = require('./utils/isPrimaryWorker');

if (isPrimaryWorker) {
  console.log('[scheduler] This worker will run cron schedulers (NODE_APP_INSTANCE=' + (process.env.NODE_APP_INSTANCE || 'none') + ')');
  startNdviScheduler(admin);

  // --------------------------------------------------
  // Data Retention Scheduler — auto-deletes patrol rows
  // and NDVI Change tables older than 1 year. Runs daily
  // at 2:00 AM and once on startup.
  // --------------------------------------------------
  startDataRetentionScheduler();
} else {
  console.log('[scheduler] Schedulers skipped on worker ' + process.env.NODE_APP_INSTANCE);
}

// --------------------------------------------------
// 2. Schema-based Validation (Joi)
// --------------------------------------------------
const loginSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .required(),

  password: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()

}).unknown(false); // Reject unknown fields

app.post("/api/changepassword", verifyJwt, async (req, res) => {
  try {

    const { username, currentPassword, newPassword } = req.body;


    // Verify the user exists and get current password hash
    const [users] = await sequelize.query(
      `SELECT username, password FROM admin WHERE username = :username`,
      { replacements: { username } }
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const user = users[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect"
      });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: "New password must be different from current password"
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await sequelize.query(
      `UPDATE admin SET password = :hashedNewPassword WHERE username = :username`,
      { replacements: { hashedNewPassword, username } }
    );


    logFromRequest(req, {
      action: 'PASSWORD_CHANGE',
      status: 'SUCCESS',
      statusCode: 200,
      username,
      resourceType: 'admin_password',
      details: { changedBy: req.user?.username || username },
    });

    return res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (err) {
    console.error("Change password error:", err);

    logFromRequest(req, {
      action: 'PASSWORD_CHANGE_FAILED',
      status: 'ERROR',
      statusCode: 500,
      username: req.body?.username || null,
      errorMessage: err.message,
    });
    
    return res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
});

app.post("/api/admin", validateNoDuplicateParams22, async (req, res) => {

  try {


    // Schema validation
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const username = value.username.trim();
    const password = value.password.trim();


    // Query database
    const [result] = await sequelize.query(
      `SELECT username, password FROM admin WHERE username = :username`,
      { replacements: { username } }
    );

    if (result.length === 0) {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username,
        errorMessage: 'User not found',
      });
      return res.status(401).json({
        success: false,
        error: "Invalid admin credentials"
      });
    }

    const admin = result[0];

    // Compare password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username,
        errorMessage: 'Invalid password',
      });
      return res.status(401).json({
        success: false,
        error: "Invalid admin credentials"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        username: admin.username
      },
      SECRET_KEY,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "24h"
      }
    );

    logFromRequest(req, {
      action: 'LOGIN',
      status: 'SUCCESS',
      statusCode: 200,
      username: admin.username,
      userRole: 'admin',
      resourceType: 'user_session',
    });

    return res.json({
      success: true,
      message: "Admin login successful",
      user: {
        username: admin.username
      },
      token
    });

  } catch (err) {

    console.error("Admin login error:", err);

    logFromRequest(req, {
      action: 'LOGIN_FAILED',
      status: 'ERROR',
      statusCode: 500,
      username: req.body?.username || null,
      errorMessage: err.message,
    });

    return res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });

  }

});

// Save user endpoint
// app.post("/api/saveuser", validateNoDuplicateParams, async (req, res) => {
//   try {
//     console.log('✅ /api/saveuser POST route accessed');
//     console.log('Request body:', req.body);
//     console.log('Request params:', req.params);
//     console.log('Request query:', req.query);
    
//     // Get username from body, params, or query (prioritize body > params > query)
//     const username = req.body?.username;
    
//     console.log('Extracted username:', username);
//     console.log('Username type:', typeof username);
//     // console.log('Source:', req.body?.username ? 'body' : (req.params?.username ? 'params' : (req.query?.username ? 'query' : 'none')));
    
//     if (username === undefined || username === null) {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username field is missing. Provide it in request body, URL parameter, or query string." 
//       });
//     }
    
//     if (typeof username !== 'string') {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username must be a string" 
//       });
//     }
    
//     if (username.trim() === "") {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username cannot be empty" 
//       });
//     }

//     const trimmedUsername = username.trim();
//     console.log('Processing username:', trimmedUsername);

//     // Check if user exists
//     const [users] = await sequelize.query(
//       `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
//       { bind: [trimmedUsername] }
//     );

//     console.log('User query result:', users);

//     let user;
//     if (users.length > 0) {
//       user = users[0];
//       console.log('User already exists:', user);
//     } else {
//       const [result] = await sequelize.query(
//         `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
//         { bind: [trimmedUsername] }
//       );
//       user = result[0];
//       console.log('New user created:', user);
//     }

//     // Generate JWT
//     const token = jwt.sign(
//       { userId: user.user_id, username: user.username }, 
//       SECRET_KEY,
//       { expiresIn: "24h" }
//     );

//     console.log('JWT generated successfully');

//     res.json({
//       success: true,
//       message: users.length > 0 ? "User already exists" : "User created",
//       user,
//       token,
//     });
    
//   } catch (err) {
//     console.error("❌ Error in /api/saveuser:", err);
//     res.status(500).json({ 
//       success: false, 
//       error: "Server error", 
//       message: err.message 
//     });
//   }
// });

const saveUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Tuned for 5000 concurrent users behind NAT
  message: {
    success: false,
    error: "Too many requests. Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// app.post("/api/saveuser22",  verifyTempToken, validateNoDuplicateParams, saveUserLimiter, async (req, res) => {
//   try {
//     console.log('✅ /api/saveuser POST route accessed');
//     console.log('Request body:', req.body);
//     console.log('Request params:', req.params);
//     console.log('Request query:', req.query);
    
//     // Get username from body, params, or query (prioritize body > params > query)
//     const username = req.body?.username;
    
//     console.log('Extracted username:', username);
//     console.log('Username type:', typeof username);
//     // console.log('Source:', req.body?.username ? 'body' : (req.params?.username ? 'params' : (req.query?.username ? 'query' : 'none')));
    
//     if (username === undefined || username === null) {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username field is missing. Provide it in request body, URL parameter, or query string." 
//       });
//     }
    
//     if (typeof username !== 'string') {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username must be a string" 
//       });
//     }
    
//     if (username.trim() === "") {
//       return res.status(400).json({ 
//         success: false, 
//         error: "Username cannot be empty" 
//       });
//     }

//     const trimmedUsername = username.trim();
//     console.log('Processing username:', trimmedUsername);

//     // Check if user exists
//     const [users] = await sequelize.query(
//       `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
//       { bind: [trimmedUsername] }
//     );

//     console.log('User query result:', users);

//     let user;
//     if (users.length > 0) {
//       user = users[0];
//       console.log('User already exists:', user);
//     } else {
//       const [result] = await sequelize.query(
//         `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
//         { bind: [trimmedUsername] }
//       );
//       user = result[0];
//       console.log('New user created:', user);
//     }

//     // Generate JWT
//     const token = jwt.sign(
//       { userId: user.user_id, username: user.username }, 
//       SECRET_KEY,
//       { expiresIn: "24h" }
//     );

//     console.log('JWT generated successfully');

//     res.json({
//       success: true,
//       message: users.length > 0 ? "User already exists" : "User created",
//       user,
//       token,
//     });
    
//   } catch (err) {
//     console.error("❌ Error in /api/saveuser:", err);
//     res.status(500).json({ 
//       success: false, 
//       error: "Server error", 
//       message: err.message 
//     });
//   }
// });



// Replace the existing /api/villages endpoint
app.get("/api/villages", verifyJwt, async (req, res) => {
  try {
    const { name } = req.body;

    if (req.query.name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Credentials must be sent in request body, not URL' 
            });
        }
    

    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: "name parameter is required" 
      });
    }

    // ✅ Use parameterized query - FIXES SQL INJECTION
    const query = `
      SELECT DISTINCT village_name, id
      FROM public.coupe_village_master
      WHERE coupe_name = $1
    `;

    const result = await sequelize.query(query, {
      bind: [name],
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error in /api/villages:', error);
    // Return generic error message
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch villages" 
    });
  }
});

// ==================== INCLUDE ROUTERS ==================== //
app.use('/api', patrolRoutes);
app.use('/api', dropdownapis);
app.use('/api', NdviRouter);
app.use('/api', notifications);
app.use('/api', userlocations);
app.use('/api', changendvi);
app.use('/api', beat_patrol_coverage);
app.use('/api', gisupload);
app.use('/api', gisupload1);
app.use('/api', forestLoginRoutes);
app.use('/api', supportRouter);
app.use('/api', incidentLogsRouter);
app.use('/api', incidentCategoriesRouter);
app.use('/api', incidentSeverityRouter);
app.use('/api/ndvi-changes', ndviChangesRouter);
app.use("/api", forestRoutes);
app.use('/api', auditLogsRouter);
// Error handling middleware
// Catch JSON parse errors (empty/malformed body with Content-Type: application/json)
// and return a clean 400 instead of crashing with a 500.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn('[json-parse] Malformed or empty JSON body on', req.method, req.originalUrl);
    return res.status(400).json({
      success: false,
      error: 'Invalid or empty JSON body',
      message: 'Request body is not valid JSON. Send a JSON object or use multipart/form-data.',
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Centralized error handler — must be last middleware
app.use(errorHandler);

// ==================== START SERVER ==================== //
const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, "0.0.0.0" , async () => {
  console.log(`✅ Backend server listening on http://0.0.0.0:${PORT}`);
  try {
    await sequelize.authenticate();
    // One-time schema setup/backfills run ONLY on the primary worker.
    // Running them in every cluster worker makes 8 workers race the same
    // DDL (CREATE INDEX IF NOT EXISTS, REFRESH, etc.) → catalog lock
    // contention, "Unknown constraint error" and pool acquire timeouts.
    if (isPrimaryWorker) {
      // Seed incident categories lookup tables after DB is confirmed ready
      try {
        await incidentCategoriesRouter.ensureIncidentCategoryTables();
        console.log('✅ Incident categories tables ensured & seeded');
      } catch (e) {
        console.error('❌ Incident categories seed failed:', e.message);
      }
      // Seed incident severity levels lookup table
      try {
        await incidentSeverityRouter.ensureIncidentSeverityTables();
        console.log('✅ Incident severity levels ensured & seeded');
      } catch (e) {
        console.error('❌ Incident severity levels seed failed:', e.message);
      }
      // Ensure incident_logs table exists after DB is confirmed ready
      try {
        await incidentLogsRouter.ensureIncidentLogsTable();
        console.log('✅ Incident logs table ensured');
      } catch (e) {
        console.error('❌ Incident logs table ensure failed:', e.message);
      }
      // Backfill patrol_code for existing patrols with NULL codes
      try {
        await patrolRoutes.backfillPatrolCodes();
        console.log('✅ Patrol codes backfilled');
      } catch (e) {
        console.error('❌ Patrol code backfill failed:', e.message);
      }
    }
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }

  // Connect to MongoDB (every worker needs its own connection)
  try {
    await connectMongo();
    console.log('✅ MongoDB connected successfully');
    if (isPrimaryWorker) {
      const MongoImage = require('./models/Image');
      await MongoImage.ensurePatrolNotesField();
      console.log('✅ Patrol image notes field ensured');
    }
  } catch (err) {
    console.error('❌ MongoDB connection/notes field check failed:', err.message);
  }

  // Add database indexes (async — don't block startup; primary worker only)
  if (isPrimaryWorker) {
    try {
      const addIndexes = require('./scripts/addIndexes');
      addIndexes().catch(e => console.warn('⚠️ Index creation warning:', e.message));
    } catch (e) {
      console.warn('⚠️ Could not load addIndexes:', e.message);
    }
  }

  // Seed AuditLog counter with current max logId (primary worker only)
  if (isPrimaryWorker) {
    try {
      const AuditLog = require('./models/AuditLog');
      const Counter = require('mongoose').model('AuditLogCounter');
      const lastDoc = await AuditLog.findOne({}, {}, { sort: { logId: -1 } });
      const currentMax = lastDoc && lastDoc.logId ? lastDoc.logId : 0;
      await Counter.findByIdAndUpdate(
        { _id: 'auditLog' },
        { $max: { seq: currentMax } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.error('⚠️ AuditLog counter seed failed:', err.message);
    }
  }


  // ==================== SERVER TUNING FOR HIGH CONCURRENCY ==================== //
  // Keep-alive: reuse TCP connections between client and server.
  try {
    server.keepAliveTimeout = 65000;   // 65s — slightly longer than headersTimeout
    server.headersTimeout = 66000;     // 66s — must be > keepAliveTimeout
    // server.requestTimeout = 120000; // Uncomment if Node.js >= v18 supports it
  } catch (e) {
    console.warn('⚠️ Server tuning skipped:', e.message);
  }

  // === Event loop monitor — detects when the server is stuck ===
  // If the event loop is blocked for >30s total, the process exits and
  // PM2/cluster restarts it automatically.
  try {
    const startMonitor = require('./middlewares/eventLoopMonitor');
    const monitor = startMonitor({
      maxLagMs: 5000,        // warn if a single lag spike > 5s
      restartAfterMs: 30000, // restart if cumulative lag > 30s
      checkIntervalMs: 5000, // check every 5s
    });
    // Store getCurrentLag so /api/health can report it
    app.locals.getEventLoopLag = monitor.getCurrentLag;
  } catch (e) {
    console.warn('⚠️ Event loop monitor skipped:', e.message);
  }
});

// Graceful shutdown — close DB pools and stop accepting new connections
// Only handle SIGTERM (used by nodemon/process managers).
// Don't handle SIGINT — let nodemon/the terminal handle Ctrl+C natively.
process.on('SIGTERM', () => {
  try { server.close(); } catch {}
  try { sequelize.close(); } catch {}
  setTimeout(() => process.exit(0), 5000);
});