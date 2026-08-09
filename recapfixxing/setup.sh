#!/bin/bash
# ============================================================
#  RECAP4NDC NDVI — Auto Setup Script for RedHat Linux
# ============================================================
#  What this does:
#    1. Installs Node.js 20.x if not present
#    2. Creates .env with your GeoServer + DB credentials
#    3. Runs npm install
#    4. Sets up cron job to run on 7th of every month at 00:30
#    5. Tests the setup with a dry run
#    6. Everything is logged to logs/setup.log
#
#  Usage:
#    chmod +x setup.sh
#    sudo ./setup.sh
# ============================================================

set -e

# ── Config ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
SETUP_LOG="$LOG_DIR/setup.log"
NODE_VERSION="20"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}[SETUP]${NC} $1"
    echo "$msg" >> "$SETUP_LOG"
}

warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1"
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "$msg" >> "$SETUP_LOG"
}

error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$msg" >> "$SETUP_LOG"
}

# ── Start ───────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

log "============================================"
log "  RECAP4NDC NDVI — Auto Setup for RedHat"
log "============================================"
log "Script directory: $SCRIPT_DIR"
log "Log directory: $LOG_DIR"

# Check root
if [ "$EUID" -ne 0 ]; then
    warn "Not running as root. Some steps (Node.js install, cron) may fail."
    warn "Recommended: sudo ./setup.sh"
fi

# ── Step 1: Install Node.js ─────────────────────────────────
log ""
log "Step 1: Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VER=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    log "Node.js already installed: v$NODE_VER"

    if [ "$NODE_MAJOR" -lt 18 ]; then
        warn "Node.js version is below 18. Upgrading to v$NODE_VERSION..."
        curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | bash -
        yum install -y nodejs
        log "Node.js upgraded to $(node -v)"
    fi
else
    log "Node.js not found. Installing Node.js v$NODE_VERSION..."
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    yum install -y nodejs
    log "Node.js installed: $(node -v)"
fi

log "npm version: $(npm -v)"

# ── Step 2: Create .env ─────────────────────────────────────
log ""
log "Step 2: Creating .env file..."

ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    warn ".env already exists. Backing up to .env.backup.$(date +%s)"
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"
fi

cat > "$ENV_FILE" << 'ENVEOF'
# ========================
# RECAP4NDC NDVI Configuration
# ========================

# GeoServer
GEOSERVER_URL=https://fmps.gujarat.gov.in:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=geoserver

# PostgreSQL Database
DB_HOST=68.178.167.216
DB_PORT=5432
DB_NAME=Recap4NDC_new
DB_USER=postgres
DB_PASSWORD=P$DB@25%$#!26
DB_SSL=false

# Google Earth Engine
EE_SERVICE_ACCOUNT_KEY=./giz-gujarat-638109c5420a.json

# Computation Parameters
SCALE=10
CHANGE_THRESHOLD=0.3

# GeoServer Layer Config
GEOSERVER_WORKSPACE=Recap4NDC
GEOSERVER_STORE=Recap4NDC_Query
GEOSERVER_STYLE_WORKSPACE=Recap4NDC_New
GEOSERVER_STYLE=NDVI_CHANGE_NEW2222
ENVEOF

log ".env created at: $ENV_FILE"

# ── Step 3: npm install ─────────────────────────────────────
log ""
log "Step 3: Installing npm dependencies..."

cd "$SCRIPT_DIR"
npm install >> "$SETUP_LOG" 2>&1
log "npm install complete."

# ── Step 4: Verify EE key exists ────────────────────────────
log ""
log "Step 4: Checking Google Earth Engine key..."

EE_KEY="$SCRIPT_DIR/giz-gujarat-638109c5420a.json"
if [ -f "$EE_KEY" ]; then
    log "EE service account key found: $EE_KEY"
else
    warn "EE service account key NOT found at: $EE_KEY"
    warn "Place your Google Earth Engine JSON key file there before running."
fi

# ── Step 5: Test run ────────────────────────────────────────
log ""
log "Step 5: Testing setup (dry run — will attempt to connect)..."

log "Running: node run_all_coupes_monthly_onefile.js --no-schedule"
if node run_all_coupes_monthly_onefile.js --no-schedule >> "$SETUP_LOG" 2>&1; then
    log "Test run completed successfully!"
else
    EXIT_CODE=$?
    warn "Test run exited with code $EXIT_CODE. Check $SETUP_LOG for details."
    warn "This may be normal if the DB or GeoServer is not reachable from this server."
    warn "The cron job will still be set up — fix connectivity issues and it will run next month."
fi

# ── Step 6: Set up cron job ─────────────────────────────────
log ""
log "Step 6: Setting up monthly cron job (7th of every month at 00:30)..."

CRON_CMD="30 0 7 * * cd $SCRIPT_DIR && /usr/bin/node run_all_coupes_monthly_onefile.js --no-schedule >> $LOG_DIR/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "run_all_coupes_monthly_onefile"; then
    warn "Cron job already exists. Removing old one and adding new..."
    crontab -l 2>/dev/null | grep -v "run_all_coupes_monthly_onefile" | crontab -
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
log "Cron job added: runs on 7th of every month at 00:30"
log "Cron command: $CRON_CMD"

# Verify
log ""
log "Current crontab entries for recap-ndvi:"
crontab -l 2>/dev/null | grep "run_all_coupes_monthly_onefile" || warn "No cron entry found!"

# ── Step 7: Create log rotation ─────────────────────────────
log ""
log "Step 7: Setting up log rotation..."

LOGROTATE_CONF="/etc/logrotate.d/recap-ndvi"
if [ "$EUID" -eq 0 ]; then
    cat > "$LOGROTATE_CONF" << 'LOGROTEOF'
/opt/recapfixxing/logs/*.log {
    monthly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
LOGROTEOF
    log "Log rotation configured at: $LOGROTATE_CONF"
    log "Logs will be rotated monthly, keeping 12 months of history."
else
    warn "Not root — skipping logrotate config. Run as root to enable log rotation."
fi

# ── Done ────────────────────────────────────────────────────
log ""
log "============================================"
log "  SETUP COMPLETE!"
log "============================================"
log ""
log "  Summary:"
log "  - Node.js: $(node -v)"
log "  - .env: $ENV_FILE"
log "  - Dependencies: installed"
log "  - Cron: 7th of every month at 00:30"
log "  - Logs: $LOG_DIR/"
log "  - Setup log: $SETUP_LOG"
log ""
log "  Manual run (test):"
log "    cd $SCRIPT_DIR"
log "    node run_all_coupes_monthly_onefile.js --no-schedule"
log ""
log "  Run for specific month:"
log "    node run_all_coupes_monthly_onefile.js --no-schedule --month=2026-07"
log ""
log "  Check logs:"
log "    tail -100 $LOG_DIR/ndvi_*.log"
log "    tail -100 $LOG_DIR/cron.log"
log ""
log "  Check cron:"
log "    crontab -l"
log ""
log "  Remove cron job:"
log "    crontab -l | grep -v run_all_coupes_monthly_onefile | crontab -"
log "============================================"
