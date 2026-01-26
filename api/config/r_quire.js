// config/ndvidatabase.js
const { Sequelize } = require('sequelize');

const DB_NAME = 'Recap4NDC_Query';
const DB_USER = 'postgres';
const DB_PASS = 'pass@123';
const DB_HOST = '68.178.167.216';
const DB_PORT = 5432;

// Create Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: console.log, // Optional: remove or set to false for production
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};

module.exports = { sequelize, testConnection };