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
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const validateAlphaNumSpaceUnderscore = require("./middlewares/validateAlphaNumSpaceUnderscore");
const { verifyJwt } = require("./middlewares/verifyJwt");
const { sequelize, testConnection } = require('./config/database');
const { connectMongo } = require('./config/mongo');
const bcrypt = require('bcrypt');
const setNoCacheHeaders = require('./middlewares/cacheControl');
const admin = require("firebase-admin");
const errorHandler = require("./middlewares/errorHandler");
const Joi = require("joi");
// At top of server.js
const blacklistedTokens = require("./middlewares/tokenBlacklist");
const helmet = require("helmet");
const crypto = require('crypto');
const rateLimit = require("express-rate-limit");
const forestRoutes = require("./routers/forest-login");
const auditMiddleware = require("./middlewares/auditMiddleware");
const auditLogsRouter = require("./routers/auditLogs");
const { logFromRequest } = require("./utils/auditLogger");
const app = express();
app.set('trust proxy', 1);
const startNdviScheduler = require("./scheduler/ndviNotificationScheduler");


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


app.use(helmet());
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

const allowedOrigins = ['https://gisfy.co.in:8445/geoserver/wms',
  'https://forestrecap.gisfy.co.in',
  'http://localhost:5002',
  'http://68.178.167.216:5002',
'http://localhost:5173', 'http://localhost:5174','http://13.235.78.63:5002', 'http://localhost:5176',
'http://3.108.143.116:8082'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Use express built-in JSON parser (remove body-parser)
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'application/*+json'] // Explicitly set accepted content types
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request Body:', req.body); // Add this for debugging
  next();
});

// In your Express app (index.js), when setting cookies:
app.use((req, res, next) => {
    // Ensure all cookies have secure flags
    const originalCookie = res.cookie;
    res.cookie = function(name, value, options = {}) {
        // Force secure settings for all cookies
        const secureOptions = {
            secure: true,           // Only send over HTTPS
            httpOnly: true,         // Prevent JavaScript access
            sameSite: 'strict',     // CSRF protection
            ...options
        };
        return originalCookie.call(this, name, value, secureOptions);
    };
    next();
});

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    // Recursively sanitize strings in the response
    function sanitizeOutput(obj) {
      if (typeof obj === 'string') {
        // Escape HTML entities
        return obj.replace(/[&<>"']/g, function(match) {
          return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }[match];
        });
      } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizeOutput(item));
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
          sanitized[key] = sanitizeOutput(obj[key]);
        }
        return sanitized;
      }
      return obj;
    }
    
    // Sanitize the response data
    const sanitizedData = sanitizeOutput(data);
    return originalJson.call(this, sanitizedData);
  };
  next();
});

// ==================== FILE STORAGE ==================== //
const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');

[patrolImageDir, incidentImageDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/Patrolimage', express.static(patrolImageDir));
app.use('/Incidentimage', express.static(incidentImageDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.startsWith('patrol_images')) {
      cb(null, patrolImageDir);
    } else {
      cb(null, incidentImageDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

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

const TEMP_SAVEUSER_TOKEN = "RECAP4NDC_TEMP_TOKEN";
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

// Test GET endpoint
app.get('/api/test', (req, res) => {
  console.log('✅ /api/test GET endpoint hit');
  res.json({ success: true, message: 'Test route works!' });
});

// Test POST endpoint to verify body parsing
app.post('/api/test-post', (req, res) => {
  console.log('✅ /api/test-post POST endpoint hit');
  console.log('Request body:', req.body);
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
  const serviceAccount = require("./routers/recap4ndc-add07-firebase-adminsdk-fbsvc-5a8fab9fe1_1967.json");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Admin initialized");
  }
} catch (err) {
  console.error("❌ Firebase service account missing:", err);
}

startNdviScheduler(admin);

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
    console.log("Change password request received");

    const { username, currentPassword, newPassword } = req.body;

    console.log(`Password change attempt for user: ${username}`);

    // Verify the user exists and get current password hash
    const [users] = await sequelize.query(
      `SELECT username, password FROM admin WHERE username = '${username}'`,
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
      `UPDATE admin SET password = '${hashedNewPassword}' WHERE username = '${username}'`,
    );

    console.log(`Password changed successfully for user: ${username}`);

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

    console.log("Admin login request received");

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

    console.log(`Admin login attempt: ${username}`);

    // Query database
    const [result] = await sequelize.query(
      `SELECT username, password FROM admin WHERE username = '${username}'`,
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
      // {
      //   expiresIn: "24h"
      // }
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
  max: 5, // Allow only 5 requests per IP per 15 mins
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
app.use("/api", forestRoutes);
app.use('/api', auditLogsRouter);
// Error handling middleware
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

app.listen(PORT, "0.0.0.0" , async () => {
  try {
    await sequelize.authenticate();
    console.log('🟢 Database connected successfully');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }

  // Connect to MongoDB
  await connectMongo();

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/test`);
  console.log(`   POST http://localhost:${PORT}/api/test-post`);
  console.log(`   POST http://localhost:${PORT}/api/forest-login`);
});