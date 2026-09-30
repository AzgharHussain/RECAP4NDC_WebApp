const mongoose = require('mongoose');

// Use MONGO_URI from environment (set in .env for both dev and production)
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set. Please check your .env file.');
  process.exit(1);
}

const connectMongo = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 500,
      minPoolSize: 10,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      // Heartbeat every 10s to detect dead connections fast
      heartbeatFrequencyMS: 10000,
    });
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
};

module.exports = { mongoose, connectMongo };
