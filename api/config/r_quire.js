// config/r_quire.js — Recap4NDC_Query database connection
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.QUERY_DB_NAME,
  process.env.QUERY_DB_USER,
  process.env.QUERY_DB_PASSWORD,
  {
    host: process.env.QUERY_DB_HOST,
    port: Number(process.env.QUERY_DB_PORT || 5432),
    dialect: 'postgres',
    logging: console.log,
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
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};

module.exports = { sequelize, testConnection };
