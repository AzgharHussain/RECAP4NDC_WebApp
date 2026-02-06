// app.js or index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
// REMOVE THIS: const bodyParser = require('body-parser'); // ❌ Remove this line

const { verifyJwt } = require("./middlewares/verifyJwt");
const { sequelize, testConnection } = require('./config/database');

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

// ==================== MIDDLEWARE ==================== //
app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Use express built-in JSON parser (remove body-parser)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request Body:', req.body); // Add this for debugging
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
const SECRET_KEY = process.env.JWT_SECRET || "mysecret123";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
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

// Admin login endpoint
app.post('/api/admin', async (req, res) => {
  try {
    console.log('✅ /api/admin POST route accessed');
    console.log('Request body:', req.body);
    
    const { username, password } = req.body;
    
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
app.post("/api/saveuser", async (req, res) => {
  try {
    console.log('✅ /api/saveuser POST route accessed');
    console.log('Request body:', req.body);
    
    const username = req.body?.username || req.query?.username;
    if (!username || username.trim() === "") {
      return res.status(400).json({ success: false, error: "Username required" });
    }

    const trimmedUsername = username.trim();

    // Check if user exists
    const [users] = await sequelize.query(
      `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
      { bind: [trimmedUsername] }
    );

    let user;
    if (users.length > 0) {
      user = users[0];
    } else {
      const [result] = await sequelize.query(
        `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
        { bind: [trimmedUsername] }
      );
      user = result[0];
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.user_id, username: user.username }, 
      SECRET_KEY
    );

    res.json({
      success: true,
      message: users.length > 0 ? "User already exists" : "User created",
      user,
      token,
    });
  } catch (err) {
    console.error("Error /api/saveuser:", err);
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
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
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