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
      max:     Number(process.env.DB_POOL_MAX     || 10),
      min:     Number(process.env.DB_POOL_MIN     || 2),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 60000),
      idle:    Number(process.env.DB_POOL_IDLE    || 10000),
      evict:   Number(process.env.DB_POOL_EVICT   || 1000),
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
          // TCP keepalive + PostgreSQL session options
          keepAlive: true,
          keepAliveInitialDelayMillis: 300000,
          statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 30000),
          idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_TX_TIMEOUT || 60000),
          application_name: process.env.DB_APPLICATION_NAME || 'recap4ndc_api',
        }
      : {
          keepAlive: true,
          keepAliveInitialDelayMillis: 300000,
          statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 30000),
          idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_TX_TIMEOUT || 60000),
          application_name: process.env.DB_APPLICATION_NAME || 'recap4ndc_api',
        },
    // Query timeout: abort any query that takes longer than 30 seconds.
    // This prevents slow spatial/geo queries from blocking the event loop.
    queryTimeout: 30000,
    // Disable query benchmark logging always — it adds I/O overhead
    // to every single query. Use DEBUG_DB_BENCHMARK=true to enable.
    benchmark: String(process.env.DEBUG_DB_BENCHMARK || '').toLowerCase() === 'true',
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
