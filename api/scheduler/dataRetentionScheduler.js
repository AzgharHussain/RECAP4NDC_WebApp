const cron = require("node-cron");
const { sequelize } = require("../config/r_quire");
const MongoImage = require("../models/Image");

/**
 * Data Retention Scheduler
 * ------------------------
 * Automatically deletes data older than 1 year:
 *   1. Patrols table rows (and their Mongo images) older than 1 year
 *   2. NDVI Change tables whose date prefix is older than 1 year
 *      (also cleans up ndvi_notification_log entries and Mongo images
 *       referencing those tables)
 *
 * Runs daily at 2:00 AM server time.
 */

const RETENTION_DAYS = 365; // 1 year
const LOG_PREFIX = "[dataRetention]";

async function queryWithRetry(client, sql, options = {}, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.query(sql, options);
    } catch (err) {
      lastErr = err;
      const isConnErr =
        err.parent?.code === 'ECONNRESET' ||
        err.parent?.code === 'ETIMEDOUT' ||
        err.parent?.code === 'EPIPE' ||
        err.parent?.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('ConnectionRefused');
      if (!isConnErr || attempt === maxRetries) throw err;
      const delay = 1000 * attempt;
      console.warn(`${LOG_PREFIX} DB query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, err.parent?.code || err.message);
      await new Promise(r => setTimeout(r, delay));
      try { await sequelize.authenticate(); } catch (_) { /* ignore */ }
    }
  }
  throw lastErr;
}

/**
 * Extract the date prefix (YYYY-MM-DD) from an NDVI table name.
 * Table names look like: 2026-01-01_aravalli_coupe_NDVI_Change
 */
function getDateFromTableName(tableName) {
  const match = String(tableName || '').match(/^(\d{4})[-_](\d{2})[-_](\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

/**
 * Delete patrol rows older than the retention period.
 * Also deletes associated Mongo images (sourceType: 'patrol').
 */
async function cleanupOldPatrols(client) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`${LOG_PREFIX} Cleaning patrols with start_time before ${cutoffISO}`);

  // 1. Get patrol IDs that will be deleted (for Mongo image cleanup)
  const oldPatrols = await queryWithRetry(client, `
    SELECT patrol_id FROM public.patrols
    WHERE start_time < $1
  `, {
    bind: [cutoffISO],
    type: sequelize.QueryTypes.SELECT,
  });

  if (!oldPatrols.length) {
    console.log(`${LOG_PREFIX} No old patrol rows to delete.`);
    return;
  }

  const oldPatrolIds = oldPatrols.map(p => p.patrol_id);
  console.log(`${LOG_PREFIX} Found ${oldPatrolIds.length} patrol rows older than 1 year.`);

  // 2. Delete associated Mongo images
  try {
    const mongoResult = await MongoImage.deleteMany({
      sourceType: 'patrol',
      patrolId: { $in: oldPatrolIds },
    });
    console.log(`${LOG_PREFIX} Deleted ${mongoResult.deletedCount} Mongo patrol images.`);
  } catch (mongoErr) {
    console.error(`${LOG_PREFIX} Failed to delete Mongo patrol images:`, mongoErr.message);
    // continue anyway — still delete the DB rows
  }

  // 3. Delete patrol rows
  const deleteResult = await queryWithRetry(client, `
    DELETE FROM public.patrols
    WHERE start_time < $1
    RETURNING patrol_id
  `, {
    bind: [cutoffISO],
    type: sequelize.QueryTypes.SELECT,
  });

  console.log(`${LOG_PREFIX} Deleted ${deleteResult.length} patrol rows from PostgreSQL.`);
}

/**
 * Delete NDVI Change tables older than the retention period.
 * Also cleans up:
 *   - ndvi_notification_log entries referencing those tables
 *   - Mongo images (sourceType: 'ndvi') referencing those tables
 */
async function cleanupOldNdviTables(client) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // 1. Get all NDVI Change tables
  const tables = await queryWithRetry(client, `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE '%_NDVI_Change'
  `, { type: sequelize.QueryTypes.SELECT });

  if (!tables.length) {
    console.log(`${LOG_PREFIX} No NDVI Change tables found.`);
    return;
  }

  // 2. Filter tables older than the cutoff
  const tablesToDelete = [];
  for (const table of tables) {
    const tableDate = getDateFromTableName(table.table_name);
    if (tableDate && tableDate < cutoffDate) {
      tablesToDelete.push(table.table_name);
    }
  }

  if (!tablesToDelete.length) {
    console.log(`${LOG_PREFIX} No NDVI Change tables older than 1 year to delete.`);
    return;
  }

  console.log(`${LOG_PREFIX} Found ${tablesToDelete.length} NDVI tables older than 1 year:`, tablesToDelete);

  // 3. Clean up ndvi_notification_log entries for these tables
  try {
    const logResult = await queryWithRetry(client, `
      DELETE FROM public.ndvi_notification_log
      WHERE table_name = ANY($1::text[])
      RETURNING id
    `, {
      bind: [tablesToDelete],
      type: sequelize.QueryTypes.SELECT,
    });
    console.log(`${LOG_PREFIX} Deleted ${logResult.length} ndvi_notification_log entries.`);
  } catch (logErr) {
    console.error(`${LOG_PREFIX} Failed to delete ndvi_notification_log entries:`, logErr.message);
  }

  // 4. Clean up Mongo images for these tables
  try {
    const mongoResult = await MongoImage.deleteMany({
      sourceType: 'ndvi',
      coupeName: { $in: tablesToDelete },
    });
    console.log(`${LOG_PREFIX} Deleted ${mongoResult.deletedCount} Mongo NDVI images.`);
  } catch (mongoErr) {
    console.error(`${LOG_PREFIX} Failed to delete Mongo NDVI images:`, mongoErr.message);
  }

  // 5. Drop the tables
  for (const tableName of tablesToDelete) {
    try {
      await queryWithRetry(client, `DROP TABLE IF EXISTS public."${tableName}" CASCADE`);
      console.log(`${LOG_PREFIX} Dropped table: ${tableName}`);
    } catch (dropErr) {
      console.error(`${LOG_PREFIX} Failed to drop table "${tableName}":`, dropErr.message);
    }
  }

  console.log(`${LOG_PREFIX} Completed NDVI table cleanup. ${tablesToDelete.length} tables dropped.`);
}

/**
 * Main retention job — runs the cleanup tasks.
 */
async function runRetentionJob() {
  console.log(`${LOG_PREFIX} Starting data retention job at ${new Date().toISOString()}`);
  const client = sequelize.getQueryInterface().sequelize;

  try {
    await cleanupOldPatrols(client);
  } catch (err) {
    console.error(`${LOG_PREFIX} Error during patrol cleanup:`, err.message);
  }

  try {
    await cleanupOldNdviTables(client);
  } catch (err) {
    console.error(`${LOG_PREFIX} Error during NDVI table cleanup:`, err.message);
  }

  console.log(`${LOG_PREFIX} Data retention job completed at ${new Date().toISOString()}`);
}

module.exports = function startDataRetentionScheduler() {
  // Run daily at 2:00 AM
  cron.schedule("0 2 * * *", () => {
    runRetentionJob().catch((err) => {
      console.error(`${LOG_PREFIX} Unhandled error in retention job:`, err);
    });
  });

  // Also run once on startup (after a short delay to let the server boot)
  setTimeout(() => {
    runRetentionJob().catch((err) => {
      console.error(`${LOG_PREFIX} Unhandled error in startup retention run:`, err);
    });
  }, 60 * 1000); // 1 minute after startup

  console.log(`${LOG_PREFIX} Data retention scheduler started. Runs daily at 2:00 AM. Retention: ${RETENTION_DAYS} days.`);
};
