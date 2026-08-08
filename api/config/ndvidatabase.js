// config/ndvidatabase.js
const { Sequelize } = require('sequelize');

// Configure pool and dialectOptions with keepAlive and optional SSL.
// You can override SSL by setting NDVI_DB_SSL=true in env.
const useSsl = String(process.env.NDVI_DB_SSL || process.env.DB_SSL || '').toLowerCase() === 'true';

const sequelize = new Sequelize(
  process.env.NDVI_DB_NAME,
  process.env.NDVI_DB_USER,
  process.env.NDVI_DB_PASSWORD,
  {
    host: process.env.NDVI_DB_HOST,
    port: Number(process.env.NDVI_DB_PORT || 5432),
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: useSsl,
    },
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};

module.exports = { sequelize, testConnection };
