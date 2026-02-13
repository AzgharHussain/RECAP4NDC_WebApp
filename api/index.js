// app.js or index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// REMOVE THIS: const bodyParser = require('body-parser'); // ❌ Remove this line

const { verifyJwt } = require("./middlewares/verifyJwt");
const { sequelize, testConnection } = require('./config/database');

const helmet = require("helmet");

// Routers
const patrolRoutes = require('./routers/patrolRoutes');
const dropdownapis = require('./routers/dropdownapis');
const NdviRouter = require('./routers/ndviRouter');
const notifications = require('./routers/notifications');
const userlocations = require('./routers/userlocations');
const changendvi = require('./routers/changendvi');
const beat_patrol_coverage = require('./routers/beat-patrol-coverage');
const gisupload = require('./routers/gisupload');
const forestLoginRoutes = require('./routers/forestLogin');

const app = express();

// Strict Express settings
app.set('query parser', 'simple');
app.set('x-powered-by', false);
app.set('etag', false);

// ✅ MUST be at the VERY TOP - before any routes
app.use(helmet()); // This enables all default Helmet protections

// ✅ Explicitly set all required headers
// In app.js, enhance your Helmet configuration

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://forestrecap.gisfy.co.in", "http://localhost:5002", "http://68.178.167.216:5002"],
      
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  xssFilter: true, // Enable XSS filter
  noSniff: true, // Set X-Content-Type-Options
  frameguard: {
    action: 'deny' // Set X-Frame-Options
  },
  hidePoweredBy: true // Remove X-Powered-By header
}));

// ✅ Your routes AFTER middleware
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/build/index.html");
});

// ==================== MIDDLEWARE ==================== //

const validateHttpHeaders = require('./middlewares/validateHttpHeaders');
app.use('/api', validateHttpHeaders);

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

const allowedOrigins = [
  'https://forestrecap.gisfy.co.in',
  'http://localhost:5002',
  'http://68.178.167.216:5002',
'http://localhost:5173'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

app.post('/api/admin', validateNoDuplicateParams, async (req, res) => {
  try {
    console.log('✅ /api/admin POST route accessed');
    console.log('Request body:', req.body);
    
    const { username, password } = req.body;

    if (req.query.username || req.query.password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Credentials must be sent in request body, not URL' 
            });
        }
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Username is required' 
      });
    }
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }

    console.log(`Admin POST login attempt: ${username}`);

    const [result] = await sequelize.query(
      `SELECT * FROM admin WHERE username = $1 AND password = $2`,
      { bind: [username.trim(), password.trim()] }
    );

    console.log(`Admin query result count: ${result.length}`);

    if (result.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid admin credentials' 
      });
    }

    const admin = result[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        username: admin.username,
      }, 
      SECRET_KEY,
    );

    res.json({ 
      success: true, 
      message: 'Admin login successful',
      user: {
        username: admin.username,
      },
      token,
      count: result.length 
    });
    
  } catch (err) {
    console.error('Error in /api/admin POST:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error', 
      message: err.message 
    });
  }
});

// Save user endpoint
app.post("/api/saveuser", validateNoDuplicateParams, async (req, res) => {
  try {
    console.log('✅ /api/saveuser POST route accessed');
    console.log('Request body:', req.body);
    console.log('Request body type:', typeof req.body);
    console.log('Content-Type:', req.get('Content-Type'));
    
    // Reject query params
    if (req.query.username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Credentials must be sent in request body, not URL' 
      });
    }

    // Check if body exists
    if (!req.body) {
      console.error('❌ Request body is empty or undefined');
      return res.status(400).json({ 
        success: false, 
        error: "Request body is required" 
      });
    }

    const username = req.body?.username;
    console.log('Extracted username:', username);
    console.log('Username type:', typeof username);
    
    if (username === undefined || username === null) {
      return res.status(400).json({ 
        success: false, 
        error: "Username field is missing in request body" 
      });
    }
    
    if (typeof username !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "Username must be a string" 
      });
    }
    
    if (username.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        error: "Username cannot be empty" 
      });
    }

    const trimmedUsername = username.trim();
    console.log('Processing username:', trimmedUsername);

    // Check if user exists
    const [users] = await sequelize.query(
      `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
      { bind: [trimmedUsername] }
    );

    console.log('User query result:', users);

    let user;
    if (users.length > 0) {
      user = users[0];
      console.log('User already exists:', user);
    } else {
      const [result] = await sequelize.query(
        `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
        { bind: [trimmedUsername] }
      );
      user = result[0];
      console.log('New user created:', user);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.user_id, username: user.username }, 
      SECRET_KEY
    );

    console.log('JWT generated successfully');

    res.json({
      success: true,
      message: users.length > 0 ? "User already exists" : "User created",
      user,
      token,
    });
    
  } catch (err) {
    console.error("❌ Error in /api/saveuser:", err);
    res.status(500).json({ 
      success: false, 
      error: "Server error", 
      message: err.message 
    });
  }
});


app.get("/api/villages", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const query = `
      SELECT DISTINCT village_name, id
      FROM public.coupe_village_master
      WHERE coupe_name = '${name}'
    `;

    const result =  await sequelize.query(query, [name]);

    res.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
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
app.use('/api', forestLoginRoutes);

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

// ==================== START SERVER ==================== //
const PORT = process.env.PORT || 5002;

app.listen(PORT, '0.0.0.0' , async () => {
  try {
    await sequelize.authenticate();
    console.log('🟢 Database connected successfully');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/test`);
  console.log(`   POST http://localhost:${PORT}/api/test-post`);
  console.log(`   POST http://localhost:${PORT}/api/forest-login`);
});