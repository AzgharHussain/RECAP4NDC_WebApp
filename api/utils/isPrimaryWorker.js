/**
 * isPrimaryWorker — true only for the first worker process.
 *
 * Used to gate one-time startup work (DDL, backfills, seeds, schedulers)
 * so it doesn't run once per worker in cluster mode.
 *
 *  - Under PM2 cluster mode, PM2 sets NODE_APP_INSTANCE = 0..N-1.
 *  - Under plain `node cluster.js`, forked workers get NODE_UNIQUE_ID = 1..N.
 *  - Single-process runs (no cluster) are always "primary".
 */
const cluster = require('cluster');

const isPrimaryWorker =
  process.env.NODE_APP_INSTANCE !== undefined
    ? process.env.NODE_APP_INSTANCE === '0'
    : !cluster.isWorker || process.env.NODE_UNIQUE_ID === '1';

module.exports = isPrimaryWorker;
