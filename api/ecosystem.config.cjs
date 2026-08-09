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

    // Instances: 'max' uses all CPU cores. Set a number to limit.
    instances: 'max',

    // Cluster mode — each instance runs in its own process
    exec_mode: 'cluster',

    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',         // must run for 10s before it's considered "up"
    restart_delay: 3000,       // wait 3s between restarts

    // Memory-based restart — restart if process uses > 1.5GB
    max_memory_restart: '1500M',

    // Health check — PM2 will restart the process if this fails
    health_check_graceful_period: 10000,
    health_check: {
      interval: 30000,         // check every 30s
      timeout: 5000,           // 5s timeout
      path: '/api/health',     // health endpoint
    },

    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 5002,
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
    kill_timeout: 5000,        // wait 5s for graceful shutdown
    listen_timeout: 10000,     // wait 10s for app to start listening
  }],
};
