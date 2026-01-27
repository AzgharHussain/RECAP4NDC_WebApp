const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

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

const app = express();

// -------------------- MIDDLEWARE -------------------- //
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -------------------- FILE STORAGE -------------------- //
const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');

if (!fs.existsSync(patrolImageDir)) fs.mkdirSync(patrolImageDir, { recursive: true });
if (!fs.existsSync(incidentImageDir)) fs.mkdirSync(incidentImageDir, { recursive: true });

app.use('/Patrolimage', express.static(patrolImageDir));
app.use('/Incidentimage', express.static(incidentImageDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.startsWith('patrol_images')) cb(null, patrolImageDir);
    else cb(null, incidentImageDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// -------------------- JWT -------------------- //
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

// -------------------- ROUTES -------------------- //

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    endpoints: [
      'POST /api/saveuser',
      'GET /api/villages?name=coupe_name',
      'GET /health',
    ]
  });
});

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.status(dbConnected ? 200 : 500).json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});




// Save user endpoint
app.post("/api/saveuser", async (req, res) => {
  try {
    const username = req.body?.username || req.query?.username;
    if (!username || username.trim() === "")
      return res.status(400).json({ success: false, error: "Username required" });

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
    const token = jwt.sign({ userId: user.user_id, username: user.username }, SECRET_KEY, { expiresIn: "24h" });

    res.json({
      success: true,
      message: users.length > 0 ? "User already exists" : "User created",
      user,
      token,
    });
  } catch (err) {
    console.error("Error /api/saveuser:", err);
    res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
});

// Get villages
app.get('/api/villages', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.trim() === '') return res.status(400).json({ success: false, error: 'Coupe name is required' });

    const [result] = await sequelize.query(
      `SELECT DISTINCT village_name, id FROM public.coupe_village_master WHERE coupe_name = $1 ORDER BY village_name`,
      { bind: [name.trim()] }
    );

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    console.error('Error /api/villages:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

// Protected route example
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Protected route accessed', user: req.user });
});

// -------------------- INCLUDE ROUTERS -------------------- //
app.use('/api', patrolRoutes);
app.use('/api', dropdownapis);
app.use('/api', NdviRouter);
app.use('/api', notifications);
app.use('/api', userlocations);
app.use('/api', changendvi);
app.use('/api', beat_patrol_coverage);
// -------------------- GLOBAL ERROR HANDLER -------------------- //
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Something went wrong' });
});

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found' }));

// -------------------- START SERVER -------------------- //
const PORT = process.env.PORT || 5002;

app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log('🟢 Database connected');
  } catch (err) {
    console.error('❌ Database connection failed', err);
  }
  console.log(`🚀 Server running on port ${PORT}`);
});
