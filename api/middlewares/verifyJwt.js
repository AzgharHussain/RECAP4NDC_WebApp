const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET; // fallback secret
const blacklistedTokens = require("./tokenBlacklist");

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Auth header received:", authHeader); // 🔥 debug

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "JWT token missing" });
  }

  // 🔥 CHECK BLACKLIST FIRST
if (blacklistedTokens.has(token)) {
  console.log("🔥 BLOCKED TOKEN:", token);
  return res.status(401).json({
    success: false,
    message: "Token has been revoked"
  });
}
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    console.log("Decoded JWT:", decoded); // 🔥 debug
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = { verifyJwt };
