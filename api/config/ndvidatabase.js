const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'recapnew', // Database name
  'postgres', // Username
  'pass@123', // Password
  {
    host: 'localhost',
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: false,
    },
    pool: {
      max: 5,
      min: 0,
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