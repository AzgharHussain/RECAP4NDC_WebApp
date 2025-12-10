// config/ndvidatabase.js
const { Sequelize } = require('sequelize');

const DB_NAME = 'Recap4NDC_new';
const DB_USER = 'postgres';
const DB_PASS = 'P$DB@25%$#!09';
const DB_HOST = '68.178.167.39';
const DB_PORT =  5432;



// const DB_NAME = 'recapnew';
// const DB_USER = 'postgres';
// const DB_PASS = 'pass@123';
// const DB_HOST = 'localhost';
// const DB_PORT =  5432;
// Configure pool and dialectOptions with keepAlive and optional SSL.
// You can override SSL by setting DB_SSL=true in env.
const useSsl = process.env.DB_SSL === 'true';

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    // Keepalive reduces chance server closes idle sockets.
    keepAlive: true,
    // SSL: set via env if needed (some hosts require SSL)
    ...(useSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {})
  },
  pool: {
    // Increased pool settings to handle bursts but not too large
    max: 20,
    min: 2,
    acquire: 120000, // ms
    idle: 30000
  },
  // Optional global query timeout (ms) - set to 0 for none
  // dialectOptions: { statement_timeout: 0 }
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
