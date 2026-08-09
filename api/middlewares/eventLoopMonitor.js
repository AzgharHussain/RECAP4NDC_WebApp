/**
 * eventLoopMonitor.js — Monitors event loop lag and auto-restarts on stall.
 *
 * The Node.js event loop processes one task at a time. If a single task
 * (e.g., a slow synchronous operation or a huge JSON parse) blocks the
 * loop for too long, the server becomes "unreachable" — it can't accept
 * new connections or respond to requests.
 *
 * This monitor measures event loop lag every 5 seconds. If the lag exceeds
 * the threshold for too long, it logs a warning and (in production) forces
 * a process restart so PM2/cluster can spawn a fresh worker.
 *
 * Usage (in index.js, after server starts):
 *   require('./middlewares/eventLoopMonitor')({ maxLagMs: 5000, restartAfterMs: 30000 });
 */
// No external imports needed — we measure lag with setImmediate timing.

function startEventLoopMonitor(options = {}) {
  const maxLagMs = options.maxLagMs || 5000;         // warn if lag > 5s
  const restartAfterMs = options.restartAfterMs || 30000; // restart if lagged for 30s total
  const checkIntervalMs = options.checkIntervalMs || 5000; // check every 5s

  let totalLagTime = 0;
  let lastCheck = Date.now();
  let monitorInterval = null;

  function checkLag() {
    const now = Date.now();
    lastCheck = now;

    // Measure event loop lag: how long does setImmediate take to fire?
    // If the event loop is healthy, this should be ~0ms.
    // If it's blocked, this will be delayed by however long the block lasts.
    // If the event loop is healthy, this should be ~0ms
    // If it's blocked, this will be delayed by however long the block lasts
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;

      if (lag > maxLagMs) {
        console.warn(`⚠️ Event loop lag: ${lag}ms (threshold: ${maxLagMs}ms)`);
        totalLagTime += lag;
      } else {
        // Reset counter if event loop is healthy
        totalLagTime = 0;
      }

      // If the event loop has been lagging for too long, force restart
      if (totalLagTime > restartAfterMs) {
        console.error(`🚨 Event loop blocked for ${totalLagTime}ms total — forcing restart!`);
        if (process.env.NODE_ENV === 'production') {
          // In production with PM2/cluster, exiting will trigger a restart
          console.error('🚨 Exiting process — PM2 will restart this worker');
          process.exit(1);
        } else {
          // In development, just warn (don't crash nodemon)
          console.error('🚨 Would force-restart in production. Resetting lag counter.');
          totalLagTime = 0;
        }
      }
    });
  }

  // Start monitoring
  monitorInterval = setInterval(checkLag, checkIntervalMs);
  monitorInterval.unref(); // Don't keep the process alive just for monitoring


  // Return a function to get current lag (used by /api/health)
  function getCurrentLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    });
  }

  return { getCurrentLag, stop: () => clearInterval(monitorInterval) };
}

module.exports = startEventLoopMonitor;
