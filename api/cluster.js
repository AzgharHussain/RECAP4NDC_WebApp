/**
 * cluster.js — Cluster mode entry point.
 *
 * Spawns one Node.js worker process per CPU core to maximize throughput.
 * Each worker runs its own independent Express server instance, sharing
 * the same port via the OS load balancer (round-robin on most platforms).
 *
 * For 5000 concurrent users this is critical — a single Node.js thread
 * can only process one JavaScript operation at a time, so spreading
 * work across N cores gives ~N× throughput for I/O-bound API requests.
 *
 * For production, prefer PM2 instead of this script:
 *   npm install -g pm2
 *   npm run pm2
 *
 * Usage:
 *   node cluster.js          (production — all cores)
 *   node cluster.js --single (single process — for debugging / nodemon)
 */
const cluster = require('cluster');
const os = require('os');
const path = require('path');

// Allow override via env (e.g. in containers with limited CPUs)
const numCPUs = Math.max(1, Number(process.env.WORKERS) || os.cpus().length);

// --single flag → skip clustering (useful for debugging with nodemon)
const singleMode = process.argv.includes('--single') || process.env.NODE_ENV === 'test';

if (singleMode) {
  // Run directly without clustering
  require(path.join(__dirname, 'index.js'));
} else if (cluster.isPrimary) {

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Track worker starts
  let workersStarted = 0;
  cluster.on('listening', (worker, address) => {
    workersStarted++;
  });

  // Restart a worker if it crashes
  cluster.on('exit', (worker, code, signal) => {
    console.error(`⚠️ Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`);
    cluster.fork();
  });

  // Graceful shutdown — only SIGTERM (let terminal handle SIGINT/Ctrl+C)
  process.on('SIGTERM', () => {
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 5000);
  });
} else {
  // Worker process — start the actual server
  require(path.join(__dirname, 'index.js'));
}
