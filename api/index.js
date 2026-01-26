const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { sequelize } = require('./config/database');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Secret
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// API Endpoints

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Server is running",
    endpoints: [
      "POST /api/saveuser",
      "GET /api/villages?name=coupe_name",
      "GET /health"
    ]
  });
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: dbConnected ? "connected" : "disconnected"
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message
    });
  }
});

// Save user endpoint
app.post("/api/saveuser", async (req, res) => {
  console.log("🟢 [/api/saveuser] API HIT");

  const username = req.body?.username || req.query?.username;

  console.log("➡️ Received username:", username);

  if (!username || username.trim() === "") {
    console.log("❌ Username missing");
    return res.status(400).json({ 
      success: false,
      error: "Username required" 
    });
  }

  const trimmedUsername = username.trim();

  try {
    console.log("🔍 Checking if user exists in DB...");

    const [users] = await sequelize.query(
      `SELECT user_id, username
       FROM public.government_department_users
       WHERE username = $1`,
      { bind: [trimmedUsername] }
    );

    console.log("📄 DB SELECT result:", users);

    let user;

    if (users.length > 0) {
      console.log("🟡 User already exists");
      user = users[0];
    } else {
      console.log("🆕 User not found, inserting new user...");

      const [result] = await sequelize.query(
        `INSERT INTO public.government_department_users (username)
         VALUES ($1)
         RETURNING user_id, username`,
        { bind: [trimmedUsername] }
      );

      console.log("✅ Insert result:", result);
      user = result[0];
    }

    console.log("🔐 Generating JWT token...");

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        iat: Math.floor(Date.now() / 1000)
      },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    console.log("🎉 User save SUCCESS:", user);

    return res.status(200).json({
      success: true,
      message: users.length > 0 ? "User already exists" : "User created",
      user,
      token,
    });

  } catch (error) {
    console.error("🔥 ERROR in /api/saveuser:", error);

    // PostgreSQL duplicate key error (unique violation)
    if (error.code === "23505" || error.name === 'SequelizeUniqueConstraintError') {
      console.log("⚠️ Duplicate username detected, fetching existing user...");

      try {
        const [users] = await sequelize.query(
          `SELECT user_id, username
           FROM public.government_department_users
           WHERE username = $1`,
          { bind: [trimmedUsername] }
        );

        if (users.length > 0) {
          const user = users[0];

          const token = jwt.sign(
            { 
              userId: user.user_id, 
              username: user.username,
              iat: Math.floor(Date.now() / 1000)
            },
            SECRET_KEY,
            { expiresIn: "24h" }
          );

          console.log("♻️ Duplicate handled, token generated");

          return res.status(200).json({
            success: true,
            message: "User already exists",
            user,
            token,
          });
        }
      } catch (fetchError) {
        console.error("❌ Failed fetching existing user:", fetchError);
      }
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get villages endpoint
app.get("/api/villages", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false,
        error: "Coupe name is required" 
      });
    }

    const trimmedName = name.trim();

    const query = `
      SELECT DISTINCT village_name, id
      FROM public.coupe_village_master
      WHERE coupe_name = $1
      ORDER BY village_name
    `;

    const [result] = await sequelize.query(query, { 
      bind: [trimmedName] 
    });

    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error("🔥 ERROR in /api/villages:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// JWT verification middleware (example for future protected routes)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: "Access denied. No token provided."
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token."
    });
  }
};

// Example protected route
app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    success: true,
    message: "Protected route accessed successfully",
    user: req.user
  });
});

/* =========================================================
   ❌ GLOBAL ERROR HANDLER
========================================================= */
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err);
  
  // Sequelize specific errors
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      success: false,
      error: 'Database connection error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

/* =========================================================
   🚀 START SERVER
========================================================= */
const PORT = process.env.PORT || 5002;

app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log('🟢 Database connected');
  } catch (e) {
    console.error('❌ Database connection failed', e);
  }

  console.log(`🚀 Server running on port ${PORT}`);
});