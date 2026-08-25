/**
 * ecosystem.config.cjs — PM2 process manager configuration.
 *
 * PM2 provides:
 *   - Auto-restart on crash
 *   - Cluster mode (uses all CPU cores)
 *   - Health check monitoring
 *   - Zero-downtime reloads
 *   - Log management
 *   - Memory-based restart (prevents memory leaks)
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs          # start in cluster mode
 *   pm2 reload ecosystem.config.cjs          # zero-downtime reload
 *   pm2 status                               # check status
 *   pm2 logs                                 # view logs
 *   pm2 monit                                # real-time monitoring
 *   pm2 stop all                             # stop all
 *   pm2 delete all                           # remove all
 */
module.exports = {
  apps: [{
    name: 'recap4ndc-api',
    script: 'cluster.js',

    // Instances: 'max' uses all CPU cores.
    // For 1M users, PM2 handles clustering directly (no need for cluster.js
    // to also fork). Set to 'max' so PM2 manages worker lifecycle.
    instances: 'max',

    // Cluster mode — each instance runs in its own process
    exec_mode: 'cluster',

    // Auto-restart on crash
    autorestart: true,
    max_restarts: 20,
    min_uptime: '10s',         // must run for 10s before it's considered "up"
    restart_delay: 2000,       // wait 2s between restarts (faster recovery)

    // Memory-based restart — restart if process uses > 2GB
    // Increased from 1.5GB to 2GB for larger DB pool sizes
    max_memory_restart: '2000M',

    // Health check — PM2 will restart the process if this fails
    health_check_graceful_period: 15000,
    health_check: {
      interval: 30000,         // check every 30s
      timeout: 5000,           // 5s timeout
      path: '/api/health',     // health endpoint
    },

    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 5002,
      // DB pool sized for 1M users with cluster mode
      DB_POOL_MAX: 100,        // per worker — with 8 workers = 800 total
      DB_POOL_MIN: 10,
    },
    env_dev: {
      NODE_ENV: 'development',
      PORT: 5002,
    },

    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // Don't watch files in production (nodemon handles dev)
    watch: false,

    // Graceful shutdown — PM2 sends SIGTERM, waits, then SIGKILL
    kill_timeout: 10000,       // wait 10s for graceful shutdown (drain connections)
    listen_timeout: 15000,     // wait 15s for app to start listening
  }],
};
