const { Sequelize } = require('sequelize');

const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: isProduction ? false : console.log,
    dialectOptions: sslEnabled
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
          },
        }
      : { ssl: false },
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
