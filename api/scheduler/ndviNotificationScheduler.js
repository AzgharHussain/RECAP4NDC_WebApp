const cron = require("node-cron");
const { sequelize } = require("../config/database");
const { ensurePixleIdColumn } = require("../utils/ensurePixleId");

/**
 * Retry wrapper for database queries that may fail with transient connection
 * errors (ECONNRESET, ETIMEDOUT, EPIPE, etc.).  Retries up to `maxRetries`
 * times with exponential backoff, and tries to re-authenticate the Sequelize
 * connection before each retry so a dropped pooled connection is restored.
 */
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
      const delay = 1000 * attempt; // 1s, 2s, 3s
      console.warn(`[scheduler] DB query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, err.parent?.code || err.message);
      await new Promise(r => setTimeout(r, delay));
      // Try to restore the connection before retrying
      try { await sequelize.authenticate(); } catch (_) { /* ignore — retry anyway */ }
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// One-time startup DDL guard — ensures the notification log table exists.
// ─────────────────────────────────────────────────────────────────────────────
let setupDone = false;

async function ensureNotificationLogTable(client) {
  if (setupDone) return;
  setupDone = true;
  try {
    await queryWithRetry(client, `
      CREATE TABLE IF NOT EXISTS public.ndvi_notification_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        table_name TEXT,
        pixel_id TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notification_type TEXT DEFAULT 'per_pixel',
        summary_count INT DEFAULT 0,
        UNIQUE(user_id, table_name, pixel_id)
      )
    `);

    // Add summary columns if they don't exist (for migration from old schema)
    await queryWithRetry(client, `
      ALTER TABLE public.ndvi_notification_log
      ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'per_pixel'
    `);
    await queryWithRetry(client, `
      ALTER TABLE public.ndvi_notification_log
      ADD COLUMN IF NOT EXISTS summary_count INT DEFAULT 0
    `);

    // Add daily summary dedup table
    await queryWithRetry(client, `
      CREATE TABLE IF NOT EXISTS public.ndvi_daily_notification_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        notification_date DATE NOT NULL,
        notification_slot INT NOT NULL,
        change_count INT DEFAULT 0,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, notification_date, notification_slot)
      )
    `);

    // Add village_name and coupe_name columns for fallback lookups when
    // a user's subscription has been removed from ndvi_notification_users.
    await queryWithRetry(client, `
      ALTER TABLE public.ndvi_daily_notification_log
      ADD COLUMN IF NOT EXISTS village_name TEXT
    `);
    await queryWithRetry(client, `
      ALTER TABLE public.ndvi_daily_notification_log
      ADD COLUMN IF NOT EXISTS coupe_name TEXT
    `);

    // Ensure pixel_id is TEXT
    const colType = await queryWithRetry(client, `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ndvi_notification_log'
        AND column_name = 'pixel_id'
      LIMIT 1
    `, { type: sequelize.QueryTypes.SELECT });

    if (colType.length > 0 && colType[0].data_type !== 'text') {
      await queryWithRetry(client, `
        ALTER TABLE public.ndvi_notification_log
        ALTER COLUMN pixel_id TYPE TEXT USING pixel_id::text
      `);
    }
  } catch (err) {
    setupDone = false;
    throw err;
  }
}

// Track which NDVI tables have already had their `pixle_id` column verified
const ensuredPixleIdTables = new Set();

// Track whether a Firebase credential error has occurred
let firebaseCredentialError = false;

const DEFAULT_NOTE_TEXT = 'NDVI decrease less than -0.3';
let cleanupDefaultNotesDone = false;

async function cleanupDefaultNotes(client) {
  if (cleanupDefaultNotesDone) return;
  cleanupDefaultNotesDone = true;
  try {
    const tables = await queryWithRetry(client, `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name LIKE '%_NDVI_Change'
    `, { type: sequelize.QueryTypes.SELECT });

    for (const { table_name } of tables) {
      try {
        const colCheck = await queryWithRetry(client, `
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'note'
        `, { bind: [table_name], type: sequelize.QueryTypes.SELECT });

        if (!colCheck.length) continue;

        await queryWithRetry(client, `
          UPDATE public."${table_name}"
          SET note = NULL
          WHERE btrim(note) = $1
        `, { bind: [DEFAULT_NOTE_TEXT] });
      } catch (_) {}
    }
  } catch (err) {
    cleanupDefaultNotesDone = false;
    console.error('[ndviScheduler] Failed to cleanup default notes:', err.message);
  }
}

/**
 * Get the current notification slot for today.
 * Slot 1 = before 09:00, Slot 2 = 09:00-14:00, Slot 3 = after 14:00
 * Returns { slot: 1|2|3, date: 'YYYY-MM-DD' }
 */
function getCurrentSlot() {
  const now = new Date();
  const hour = now.getHours();
  const date = now.toISOString().slice(0, 10);
  let slot;
  if (hour < 9) slot = 1;
  else if (hour < 14) slot = 2;
  else slot = 3;
  return { slot, date };
}

/**
 * Core NDVI notification logic — DAILY 3 TIMES, ONE SUMMARY NOTIFICATION PER USER.
 *
 * Instead of sending per-pixel notifications every minute, this sends ONE
 * notification per user per slot (3 times daily) summarizing the last month's
 * NDVI changes for their subscribed village/coupe.
 *
 * Schedule: 3 cron jobs at 08:00, 13:00, 18:00 IST
 */
async function runNdviNotifications(admin) {
  firebaseCredentialError = false;

  try {
    const client = sequelize.getQueryInterface().sequelize;
    await ensureNotificationLogTable(client);
    await cleanupDefaultNotes(client);

    const { slot, date } = getCurrentSlot();

    // ------------------------------------------------
    // 1️⃣ Get NDVI tables
    // ------------------------------------------------
    const tables = await queryWithRetry(client, `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      AND table_name LIKE '%_NDVI_Change'
    `, { type: sequelize.QueryTypes.SELECT });

    if (!tables.length) {
      console.log('[ndvi-scheduler] No NDVI Change tables found.');
      return;
    }

    // ------------------------------------------------
    // 2️⃣ Get subscribed users
    // ------------------------------------------------
    const users = await queryWithRetry(client, `
      SELECT user_id, firebase_token, village_name, coupe_name
      FROM public.ndvi_notification_users
      WHERE firebase_token IS NOT NULL
    `, { type: sequelize.QueryTypes.SELECT });

    if (!users.length) {
      console.log('[ndvi-scheduler] No subscribed users with valid tokens.');
      return;
    }

    console.log(`[ndvi-scheduler] Daily slot ${slot} run — checking ${tables.length} table(s) for ${users.length} user(s)...`);

    // ------------------------------------------------
    // 3️⃣ For each user, collect last month's changes and send ONE summary notification
    // ------------------------------------------------
    let notificationsSent = 0;

    for (const user of users) {
      const { user_id, firebase_token, village_name, coupe_name } = user;

      if (firebaseCredentialError) break;

      // Check if already sent for this user/date/slot
      const alreadySent = await queryWithRetry(client, `
        SELECT 1 FROM public.ndvi_daily_notification_log
        WHERE user_id = $1 AND notification_date = $2 AND notification_slot = $3
        LIMIT 1
      `, {
        bind: [user_id, date, slot],
        type: sequelize.QueryTypes.SELECT
      });

      if (alreadySent.length > 0) {
        continue; // Already sent for this slot today
      }

      // Collect all NDVI changes for this user's village/coupe from last month
      let totalChanges = 0;
      // Track the first (primary) table that had changes for this village.
      // Sent at the top level of the notification data payload so the client
      // can call the village-records API directly when the user taps the
      // notification, without having to parse a bulky `changes` JSON array.
      let primaryTableName = '';

      for (const table of tables) {
        const tableName = table.table_name;

        // Match coupe
        if (!tableName.toUpperCase().includes(`_${coupe_name.toUpperCase()}_NDVI_CHANGE`)) {
          continue;
        }

        // Ensure pixle_id column
        if (!ensuredPixleIdTables.has(tableName)) {
          try {
            await ensurePixleIdColumn(client, tableName, { isSequelize: true });
            ensuredPixleIdTables.add(tableName);
          } catch (ensureErr) {
            console.error(`[ndvi-scheduler] ensurePixleId failed for "${tableName}":`, ensureErr.message);
          }
        }

        // Query last month's changes for this village
        try {
          const records = await queryWithRetry(client, `
            SELECT
              pixle_id,
              "NDVI_change",
              change_category,
              longitude,
              latitude,
              village
            FROM public."${tableName}"
            WHERE village = $1
            ORDER BY "NDVI_change" DESC
          `, {
            bind: [village_name],
            type: sequelize.QueryTypes.SELECT
          });

          if (records.length > 0) {
            totalChanges += records.length;
            if (!primaryTableName) primaryTableName = tableName;
          }
        } catch (queryErr) {
          console.error(`[ndvi-scheduler] Query failed for table "${tableName}":`, queryErr.message);
        }
      }

      if (totalChanges === 0) {
        continue; // No changes for this user — skip notification
      }

      // ------------------------------------------------
      // 4️⃣ Send ONE summary Firebase notification
      // ------------------------------------------------
      const message = {
        token: firebase_token,
        notification: {
          title: `NDVI Alert 🌿 — ${totalChanges} change(s) detected`,
          body: `${totalChanges} vegetation change(s) detected in ${village_name} in the last month. Tap to view details.`
        },
        data: {
          type: 'ndvi_summary',
          user_id,
          village_name,
          coupe_name,
          table_name: primaryTableName,
          total_changes: String(totalChanges),
          notification_date: date,
          notification_slot: String(slot)
        }
      };

      try {
        await admin.messaging().send(message);
        notificationsSent++;

        // Log the daily notification
        await queryWithRetry(client, `
          INSERT INTO public.ndvi_daily_notification_log
          (user_id, notification_date, notification_slot, change_count, sent_at, village_name, coupe_name)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
          ON CONFLICT (user_id, notification_date, notification_slot) DO NOTHING
        `, {
          bind: [user_id, date, slot, totalChanges, village_name, coupe_name],
          type: sequelize.QueryTypes.INSERT
        });

        console.log(`[ndvi-scheduler] Sent summary notification to user ${user_id}: ${totalChanges} changes in ${village_name}`);

      } catch (err) {
        const isCredentialError = err.message && (
          err.message.includes('Invalid JWT Signature') ||
          err.message.includes('invalid_grant') ||
          err.message.includes('failed to fetch a valid Google OAuth2 access token')
        );

        if (isCredentialError) {
          firebaseCredentialError = true;
          console.error("[ndvi-scheduler] Firebase credential error — notifications will not be sent until the service account key is regenerated.");
          break;
        }

        console.error("[ndvi-scheduler] Firebase send error:", err.message);

        // Clear invalid tokens
        const isInvalidToken =
          err.code === "messaging/registration-token-not-registered" ||
          err.code === "messaging/invalid-registration-token" ||
          (err.message && err.message.includes("Requested entity was not found"));

        if (isInvalidToken) {
          try {
            await client.query(`
              UPDATE public.ndvi_notification_users
              SET firebase_token = NULL
              WHERE user_id = $1
            `, {
              bind: [user_id],
              type: sequelize.QueryTypes.UPDATE
            });
          } catch (cleanupErr) {
            console.error("[ndvi-scheduler] Failed clearing invalid token:", cleanupErr.message);
          }
        }
      }
    }

    console.log(`[ndvi-scheduler] Daily slot ${slot} run completed. ${notificationsSent} notification(s) sent.`);
  } catch (err) {
    console.error("[ndvi-scheduler] Scheduler error:", err);
  }
}

module.exports = function startNdviScheduler(admin) {

  // ───────────────────────────────────────────────────────────────
  // Deferred startup run — 30s after server start
  // ───────────────────────────────────────────────────────────────
  console.log('[ndvi-scheduler] Startup run deferred by 30s to let server bind first...');
  setTimeout(() => {
    console.log('[ndvi-scheduler] Running deferred startup run...');
    runNdviNotifications(admin).catch((err) => {
      console.error('[ndvi-scheduler] Deferred startup run failed:', err.message);
    });
  }, 30 * 1000);

  // ───────────────────────────────────────────────────────────────
  // Daily 3 times: 08:00, 13:00, 18:00 (server local time)
  // One summary notification per user with last month's changes.
  // ───────────────────────────────────────────────────────────────
  cron.schedule("0 8 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (08:00) — running daily summary...');
    await runNdviNotifications(admin);
  });

  cron.schedule("0 13 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (13:00) — running daily summary...');
    await runNdviNotifications(admin);
  });

  cron.schedule("0 18 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (18:00) — running daily summary...');
    await runNdviNotifications(admin);
  });

  console.log('[ndvi-scheduler] Scheduler registered. Startup run deferred 30s. Cron: daily at 08:00, 13:00, 18:00.');
};
