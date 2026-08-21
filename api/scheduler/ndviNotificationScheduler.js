const cron = require("node-cron");
const { sequelize } = require("../config/r_quire");
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

async function ensureNotificationLogPixelIdText(client) {
  await queryWithRetry(client, `
    CREATE TABLE IF NOT EXISTS public.ndvi_notification_log (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      table_name TEXT,
      pixel_id TEXT,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, table_name, pixel_id)
    )
  `);
  await queryWithRetry(client, `
    ALTER TABLE public.ndvi_notification_log
    ALTER COLUMN pixel_id TYPE TEXT USING pixel_id::text
  `);
  await queryWithRetry(client, `
    ALTER TABLE public.ndvi_notification_log
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);
  await queryWithRetry(client, `
    UPDATE public.ndvi_notification_log
    SET sent_at = CURRENT_TIMESTAMP
    WHERE sent_at IS NULL
  `);
}

const DEFAULT_NOTE_TEXT = 'NDVI decrease less than -0.3';

/**
 * Clean up the default auto-generated note from all NDVI Change tables.
 * Sets note = NULL where note = 'NDVI decrease less than -0.3'.
 * Runs once per scheduler tick (idempotent — no-op if already clean).
 */
async function cleanupDefaultNotes(client) {
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
        // Check if the table has a note column
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
    console.error('[ndviScheduler] Failed to cleanup default notes:', err.message);
  }
}

/**
 * Core NDVI notification logic — runs on server startup AND on cron schedule.
 * Sends pending NDVI alerts to all subscribed users.
 */
async function runNdviNotifications(admin) {
  try {
    const client = sequelize.getQueryInterface().sequelize;
    await ensureNotificationLogPixelIdText(client);

    // Clean up default notes in NDVI Change tables
    await cleanupDefaultNotes(client);

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

    console.log(`[ndvi-scheduler] Checking ${tables.length} table(s) for ${users.length} user(s)...`);

    // ------------------------------------------------
    // 3️⃣ Loop NDVI tables
    // ------------------------------------------------
    for (const table of tables) {

      const tableName = table.table_name;

      // ------------------------------------------------
      // 3.5️⃣ Ensure the table has a `pixle_id` column.
      //    Some NDVI tables are auto-created without it; the scheduler
      //    SELECTs pixle_id below, so we add + populate it (unique values,
      //    not a primary key) when missing. Idempotent & cheap.
      // ------------------------------------------------
      try {
        await ensurePixleIdColumn(client, tableName, { isSequelize: true });
      } catch (ensureErr) {
        console.error(`❌ ensurePixleId failed for "${tableName}":`, ensureErr.message);
        // continue anyway — the query below has its own try/catch
      }

      for (const user of users) {

        const { user_id, firebase_token, village_name, coupe_name } = user;

        // Match coupe
        if (!tableName.toUpperCase().includes(`_${coupe_name.toUpperCase()}_NDVI_CHANGE`)) {
          continue;
        }

        // ------------------------------------------------
        // 4️⃣ Get NDVI change record
        //    Wrapped in try-catch so a column mismatch in
        //    one table doesn't crash the entire scheduler.
        // ------------------------------------------------
        let records;
        try {
          records = await queryWithRetry(client, `
            SELECT
              pixle_id,
              "NDVI_change",
              change_category,
              longitude,
              latitude
            FROM public."${tableName}"
            WHERE village = $1
            ORDER BY "NDVI_change" DESC
            LIMIT 1
          `, {
            bind: [village_name],
            type: sequelize.QueryTypes.SELECT
          });
        } catch (queryErr) {
          console.error(`❌ Query failed for table "${tableName}" (possible column mismatch):`, queryErr.message);
          continue; // skip this table, move to next user/table
        }

        if (!records.length) continue;

        const record = records[0];
        const pixelId = String(record.pixle_id);

        // ------------------------------------------------
        // 5️⃣ Check if already notified
        // ------------------------------------------------
        const alreadySent = await queryWithRetry(client, `
          SELECT 1
          FROM public.ndvi_notification_log
          WHERE user_id = $1
          AND table_name = $2
          AND pixel_id = $3
          LIMIT 1
        `, {
          bind: [user_id, tableName, pixelId],
          type: sequelize.QueryTypes.SELECT
        });

        if (alreadySent.length) {
          continue;
        }

        // ------------------------------------------------
        // 6️⃣ Prepare Firebase message
        // ------------------------------------------------
        const message = {
          token: firebase_token,
          notification: {
            title: "NDVI Alert 🌿",
            body: `Vegetation change detected in ${village_name}`
          },
          data: {
            pixle_id: String(pixelId),
            village_name,
            coupe_name,
            latitude: String(record.latitude || ""),
            longitude: String(record.longitude || ""),
            ndvi_change: String(record.NDVI_change || ""),
            change_category: String(record.change_category || ""),
            table_name: tableName
          }
        };

        try {

          // ------------------------------------------------
          // 7️⃣ Send Firebase notification
          // ------------------------------------------------
          await admin.messaging().send(message);

          // ------------------------------------------------
          // 8️⃣ Insert log record
          // ------------------------------------------------
          await queryWithRetry(client, `
            INSERT INTO public.ndvi_notification_log
            (user_id, table_name, pixel_id, sent_at)
            VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
          `, {
            bind: [user_id, tableName, pixelId],
            type: sequelize.QueryTypes.INSERT
          });

        } catch (err) {

          const isCredentialError = err.message && (
            err.message.includes('Invalid JWT Signature') ||
            err.message.includes('invalid_grant') ||
            err.message.includes('failed to fetch a valid Google OAuth2 access token')
          );

          if (isCredentialError) {
            console.error("❌ Firebase credential error — notifications will not be sent until the service account key is regenerated.");
            console.error("   Generate a new key at: https://console.firebase.google.com/project/recap4ndc-add07/settings/serviceaccounts/adminsdk");
            break; // stop trying — all sends will fail with the same credential error
          }

          console.error("❌ Firebase send error:", err.message);

          // ------------------------------------------------
          // Invalid/unregistered token — clear it so we stop
          // retrying it on every scheduler run.
          // ------------------------------------------------
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
              console.error("❌ Failed clearing invalid token:", cleanupErr.message);
            }
          }

        }

      }

    }

    console.log('[ndvi-scheduler] Run completed.');
  } catch (err) {
    console.error("❌ Scheduler error:", err);
  }
}

module.exports = function startNdviScheduler(admin) {

  // ─────────────────────────────────────────────────────────────
  // Run immediately on server startup — don't wait for the cron
  // ─────────────────────────────────────────────────────────────
  console.log('[ndvi-scheduler] Running on startup...');
  runNdviNotifications(admin).catch((err) => {
    console.error('[ndvi-scheduler] Startup run failed:', err.message);
  });

  // ─────────────────────────────────────────────────────────────
  // Then run on cron schedule (every 10 minutes)
  // ─────────────────────────────────────────────────────────────
  cron.schedule("*/10 * * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick — running...');
    await runNdviNotifications(admin);
  });

};