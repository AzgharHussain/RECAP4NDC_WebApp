const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET; // fallback secret
const blacklistedTokens = require("./tokenBlacklist");

const verifyJwt = (req, res, next) => {
  // 1) Try Authorization header first
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    token = authHeader.split(" ")[1];
  }

  // 2) Fallback: check cookies (authToken cookie set during login)
  if (!token && req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  }


  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ success: false, message: "JWT token missing" });
  }

  // 🔥 CHECK BLACKLIST FIRST
  if (blacklistedTokens.has(token)) {
    return res.status(401).json({
      success: false,
      message: "Token has been revoked"
    });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = { verifyJwt };
