/**
 * database.js — SINGLE PostgreSQL connection for the entire application.
 *
 * All other config files (db.js, ndvidatabase.js, r_quire.js) re-export
 * from this file so that only ONE connection pool is used throughout.
 *
 * Configure via .env:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL, NODE_ENV
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    Number(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false,
    pool: {
      max:     Number(process.env.DB_POOL_MAX     || 50),
      min:     Number(process.env.DB_POOL_MIN     || 5),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 60000),
      idle:    Number(process.env.DB_POOL_IDLE    || 30000),
      evict:   Number(process.env.DB_POOL_EVICT   || 10000),
    },
    // Keep idle connections alive so remote DBs / firewalls don't drop them.
    // Without this, idle pooled connections silently die and the next query
    // gets an ECONNRESET.
    dialectOptions: sslEnabled
      ? {
          ssl: {
            require: true,
            rejectUnauthorized:
              String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
          },
          // TCP keepalive: probe every 30s after 30s idle
          keepAlive: true,
          keepAliveInitialDelayMillis: 30000,
        }
      : {
          keepAlive: true,
          keepAliveInitialDelayMillis: 30000,
        },
    // Query timeout: abort any query that takes longer than 30 seconds.
    // This prevents slow spatial/geo queries from blocking the event loop.
    queryTimeout: 30000,
    benchmark: !isProduction,
  }
);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    return true;
  } catch (error) {
    console.error('❌ 888888Unable to connect to the database:', error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection };
