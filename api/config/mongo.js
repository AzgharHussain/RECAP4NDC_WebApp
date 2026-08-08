const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

const connectMongo = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 20,
    });
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
};

module.exports = { mongoose, connectMongo };
