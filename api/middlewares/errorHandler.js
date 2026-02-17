// Centralized Error Handler

module.exports = (err, req, res, next) => {
  // Log full error only on server
  console.error("🔥 Internal Error:", {
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
    time: new Date().toISOString()
  });

  // Default safe response
  let statusCode = err.statusCode || 500;
  let clientMessage = "Something went wrong. Please try again later.";

  // Handle known errors safely
  if (err.name === "SequelizeDatabaseError") {
    statusCode = 400;
    clientMessage = "Invalid request parameters.";
  }

  if (err.name === "SequelizeConnectionError") {
    statusCode = 500;
    clientMessage = "Database connection error.";
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage
  });
};
