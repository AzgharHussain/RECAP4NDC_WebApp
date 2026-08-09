# RECAP4NDC NDVI — RedHat Linux Setup

## Quick Start (one command)

```bash
# 1. Copy this folder to the server
scp -r recapfixxing/ user@your-server:/opt/recapfixxing

# 2. SSH into server
ssh user@your-server
cd /opt/recapfixxing

# 3. Make setup script executable
chmod +x setup.sh

# 4. Run setup (installs Node.js, creates .env, npm install, cron job)
sudo ./setup.sh
```

## What `setup.sh` does automatically

| Step | Action |
|------|--------|
| 1 | Installs Node.js 20.x (if not present or outdated) |
| 2 | Creates `.env` with GeoServer + DB credentials |
| 3 | Runs `npm install` |
| 4 | Verifies Google Earth Engine key file exists |
| 5 | Tests the setup with a dry run |
| 6 | Creates cron job: **7th of every month at 00:30** |
| 7 | Sets up log rotation (keeps 12 months of logs) |

## After setup

### Manual run (test)
```bash
cd /opt/recapfixxing
node run_all_coupes_monthly_onefile.js --no-schedule
```

### Run for a specific month
```bash
node run_all_coupes_monthly_onefile.js --no-schedule --month=2026-07
```

### Check logs
```bash
# NDVI computation logs
tail -100 logs/ndvi_*.log

# Cron execution logs
tail -100 logs/cron.log

# Setup log
cat logs/setup.log
```

### Check cron is set
```bash
crontab -l
# Should show:
# 30 0 7 * * cd /opt/recapfixxing && /usr/bin/node run_all_coupes_monthly_onefile.js --no-schedule >> /opt/recapfixxing/logs/cron.log 2>&1
```

### Remove cron job
```bash
crontab -l | grep -v run_all_coupes_monthly_onefile | crontab -
```

## Configuration (.env)

The `.env` file is auto-created by `setup.sh`. Edit it if needed:

```env
# GeoServer
GEOSERVER_URL=https://fmps.gujarat.gov.in:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=geoserver

# PostgreSQL
DB_HOST=68.178.167.216
DB_PORT=5432
DB_NAME=Recap4NDC_new
DB_USER=postgres
DB_PASSWORD=P$DB@25%$#!26
DB_SSL=false

# Google Earth Engine
EE_SERVICE_ACCOUNT_KEY=./giz-gujarat-638109c5420a.json
```

## Files

```
recapfixxing/
├── setup.sh                              ← Run this first (auto-setup)
├── run_all_coupes_monthly_onefile.js     ← Main NDVI script
├── giz-gujarat-638109c5420a.json         ← Google Earth Engine key
├── package.json                          ← Dependencies
├── .env                                  ← Auto-created by setup.sh
├── README.md                             ← This file
└── logs/                                 ← All logs go here
    ├── setup.log                         ← Setup output
    ├── cron.log                          ← Cron execution output
    └── ndvi_2026-07-01_*.log             ← NDVI computation logs
```

## Troubleshooting

### Node.js not installed
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs
```

### Cannot connect to database
```bash
# Test DB connectivity
psql -h 68.178.167.216 -p 5432 -U postgres -d Recap4NDC_new

# Check firewall
sudo firewall-cmd --list-ports
sudo firewall-cmd --add-port=5432/tcp --permanent
```

### Cannot connect to GeoServer
```bash
# Test GeoServer
curl -k https://fmps.gujarat.gov.in:8080/geoserver/web/

# Check if port 8080 is open
sudo firewall-cmd --add-port=8080/tcp --permanent
```

### Cron not running
```bash
# Check cron service
sudo systemctl status crond
sudo systemctl enable crond
sudo systemctl start crond

# Check cron log
tail -100 /var/log/cron
```
