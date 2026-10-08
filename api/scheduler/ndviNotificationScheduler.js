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
        change_month TEXT
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

    // Add change_month column to track which month's NDVI data was sent.
    // Stored as YYYY-MM (e.g. "2026-08"), extracted from the NDVI Change
    // table name prefix (e.g. "2026-08-01_Coupe_NDVI_Change").
    await queryWithRetry(client, `
      ALTER TABLE public.ndvi_daily_notification_log
      ADD COLUMN IF NOT EXISTS change_month TEXT
    `);

    // The scheduler now sends one notification per user PER MONTH (last 3
    // months) in each slot, so the dedup key must include change_month.
    // Drop the old 3-column UNIQUE(user_id, notification_date, notification_slot)
    // constraint (if present) and replace it with a 4-column unique index.
    await queryWithRetry(client, `
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'public.ndvi_daily_notification_log'::regclass
            AND contype = 'u'
            AND array_length(conkey, 1) = 3
        LOOP
          EXECUTE format('ALTER TABLE public.ndvi_daily_notification_log DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$;
    `);
    await queryWithRetry(client, `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ndvi_daily_log_user_date_slot_month
      ON public.ndvi_daily_notification_log (user_id, notification_date, notification_slot, change_month)
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
 * Get the current notification slot for today (in IST, Asia/Kolkata).
 * Slot 1 = before 09:00, Slot 2 = 09:00-14:00, Slot 3 = after 14:00
 * Returns { slot: 1|2|3, date: 'YYYY-MM-DD' }
 *
 * Computed in IST regardless of server timezone so the 08:00 / 13:00 / 18:00
 * IST cron ticks always land in 3 distinct slots (on a UTC server, 08:00 and
 * 13:00 IST would otherwise both fall into slot 1 and overwrite each other).
 */
const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30
function getCurrentSlot() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const hour = ist.getUTCHours();
  const date = ist.toISOString().slice(0, 10);
  let slot;
  if (hour < 9) slot = 1;
  else if (hour < 14) slot = 2;
  else slot = 3;
  return { slot, date };
}

/**
 * Compute the previous calendar month's date prefix and readable label.
 * NDVI Change tables are named like "2024-08-01_Coupe_NDVI_Change", where
 * the leading "YYYY-MM-01" identifies the month the changes belong to.
 *
 * Returns { prefix: 'YYYY-MM-01', label: 'Month YYYY' }
 *   prefix — used to filter table names (e.g. "2026-08-01")
 *   label  — human-readable month for notification text (e.g. "August 2026")
 */
function getPreviousMonth(monthsBack = 1) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() - monthsBack; // 0-indexed
  while (month < 0) {
    month += 12;
    year -= 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return {
    prefix: `${year}-${pad(month + 1)}-01`,
    label: `${monthNames[month]} ${year}`,
  };
}

// Number of past calendar months the scheduler loops over (most recent first).
const NOTIFICATION_MONTHS_BACK = 3;

/**
 * Returns the last `count` calendar months, most recent first.
 * e.g. on 2026-10-07 with count=3 → Sep 2026, Aug 2026, Jul 2026.
 */
function getPreviousMonths(count = NOTIFICATION_MONTHS_BACK) {
  const months = [];
  for (let i = 1; i <= count; i++) months.push(getPreviousMonth(i));
  return months;
}

function normalizeCoupeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]/, '')
    .replace(/ndvi[-_]?change$/i, '')
    .replace(/forest[-_ ]?division/g, '')
    .replace(/coupes?/g, '')
    .replace(/view/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Core NDVI notification logic — DAILY 3 TIMES, LOOPING OVER THE LAST 3 MONTHS.
 *
 * Instead of sending per-pixel notifications every minute, this sends ONE
 * summary notification per user, per month, per slot (3 times daily) for
 * each of the last NOTIFICATION_MONTHS_BACK calendar months (most recent
 * first) covering their subscribed village/coupe.
 *
 * NDVI Change tables are named like "2026-08-01_Coupe_NDVI_Change", where
 * the leading date identifies the month. Each month's tables are queried
 * separately, so every notification's text names the correct month.
 *
 * Schedule: 3 cron jobs at 08:00, 13:00, 18:00 IST
 */
async function runNdviNotifications(admin, opts = {}) {
  firebaseCredentialError = false;

  try {
    const client = sequelize.getQueryInterface().sequelize;
    await ensureNotificationLogTable(client);
    await cleanupDefaultNotes(client);

    const months = getPreviousMonths();
    console.log(`[ndvi-scheduler] ${opts.reason === 'startup' ? 'Server-start run — l' : 'L'}ooping over last ${months.length} month(s): ${months.map(m => m.label).join(', ')}`);

    for (const month of months) {
      if (firebaseCredentialError) break;
      await runNdviNotificationsForMonth(admin, client, month, { reason: opts.reason });
    }
  } catch (err) {
    console.error("[ndvi-scheduler] Scheduler error:", err);
  }
}

/**
 * Event-triggered send: runs the same last-3-months loop for ONE user.
 * Called on login, subscription (POST /send-notifications) and
 * subscription/village updates (PUT /update-notification-user).
 *
 * Debounced per user (EVENT_DEBOUNCE_MS) so that a login immediately followed
 * by the app re-subscribing with its token/village only produces ONE batch,
 * using the latest saved token + village. Fire-and-forget: never throws.
 */
const EVENT_DEBOUNCE_MS = 10 * 1000;
const pendingUserSends = new Map(); // userId -> { timer, reasons:Set }

function sendNdviNotificationsForUser(admin, userId, reason = 'update') {
  if (userId === undefined || userId === null || String(userId).trim() === '') return;
  const id = String(userId).trim();

  const pending = pendingUserSends.get(id) || { timer: null, reasons: new Set() };
  pending.reasons.add(reason);
  if (pending.timer) clearTimeout(pending.timer);

  pending.timer = setTimeout(async () => {
    pendingUserSends.delete(id);
    const reasons = [...pending.reasons].join('+');
    try {
      const client = sequelize.getQueryInterface().sequelize;
      await ensureNotificationLogTable(client);
      firebaseCredentialError = false;
      const months = getPreviousMonths();
      console.log(`[ndvi-scheduler] Event send for user ${id} (${reasons}) \u2014 months: ${months.map(m => m.label).join(', ')}`);
      for (const month of months) {
        if (firebaseCredentialError) break;
        await runNdviNotificationsForMonth(admin, client, month, { userId: id, reason: reasons });
      }
    } catch (err) {
      console.error(`[ndvi-scheduler] Event send for user ${id} failed:`, err.message);
    }
  }, EVENT_DEBOUNCE_MS);

  pendingUserSends.set(id, pending);
}

/**
 * Sends one summary notification per subscribed user for a single month.
 * @param {object} month { prefix: 'YYYY-MM-01', label: 'Month YYYY' }
 * @param {object} [opts]
 * @param {string} [opts.userId]  Only notify this user (event-triggered send).
 * @param {string} [opts.reason]  Why the send was triggered (for logs).
 */
async function runNdviNotificationsForMonth(admin, client, month, opts = {}) {
  try {
    const isEvent = !!opts.userId;
    // Ad-hoc = event-triggered (login/subscribe/update) or server-start run.
    const isAdHoc = isEvent || opts.reason === 'startup';
    const current = getCurrentSlot();
    const date = current.date;
    // Ad-hoc sends (login / subscription / village update / server start) are
    // logged as slot 0 so they don't overwrite the scheduled 08:00/13:00/18:00 rows.
    const slot = isAdHoc ? 0 : current.slot;
    const { prefix: monthPrefix, label: monthLabel } = month;

    // ------------------------------------------------
    // 1️⃣ Get NDVI tables — only those for the previous month
    //    Table names look like "2026-08-01_Coupe_NDVI_Change", so we filter
    //    by the leading YYYY-MM-01 date prefix.
    // ------------------------------------------------
    const tables = await queryWithRetry(client, `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      AND table_name LIKE '${monthPrefix}%_NDVI_Change'
    `, { type: sequelize.QueryTypes.SELECT });

    if (!tables.length) {
      console.log(`[ndvi-scheduler] No NDVI Change tables found for ${monthLabel} (${monthPrefix}).`);
      return;
    }

    // ------------------------------------------------
    // 2️⃣ Get subscribed users
    // ------------------------------------------------
    const users = await queryWithRetry(client, `
      SELECT user_id, firebase_token, village_name, coupe_name
      FROM public.ndvi_notification_users
      WHERE firebase_token IS NOT NULL
      ${isEvent ? 'AND user_id = $1' : ''}
    `, {
      ...(isEvent ? { bind: [String(opts.userId)] } : {}),
      type: sequelize.QueryTypes.SELECT
    });

    if (!users.length) {
      console.log(isEvent
        ? `[ndvi-scheduler] User ${opts.userId} has no subscription with a valid token — nothing to send (${opts.reason}).`
        : '[ndvi-scheduler] No subscribed users with valid tokens.');
      return;
    }

    console.log(isEvent
      ? `[ndvi-scheduler] Event send (${opts.reason}) — ${monthLabel}: checking ${tables.length} table(s) for user ${opts.userId}...`
      : `[ndvi-scheduler] Daily slot ${slot} run — ${monthLabel}: checking ${tables.length} table(s) for ${users.length} user(s)...`);

    // ------------------------------------------------
    // 3️⃣ For each user, collect last month's changes and send ONE summary notification
    // ------------------------------------------------
    let notificationsSent = 0;
    let repeatedNotificationCount = 0;
    let coupeMismatchCount = 0;
    let noRecordsCount = 0;
    let firebaseFailureCount = 0;

    for (const user of users) {
      const { user_id, firebase_token, village_name, coupe_name } = user;

      if (firebaseCredentialError) break;

      // Collect all NDVI changes for this user's village/coupe from last month
      let totalChanges = 0;
      let matchedTableCount = 0;
      let notificationVillage = village_name;
      let notificationCoupe = coupe_name;
      let repeatedNotification = false;
      const normalizedUserCoupe = normalizeCoupeName(coupe_name);
      // Track the first (primary) table that had changes for this village.
      // Sent at the top level of the notification data payload so the client
      // can call the village-records API directly when the user taps the
      // notification, without having to parse a bulky `changes` JSON array.
      let primaryTableName = '';

      for (const table of tables) {
        const tableName = table.table_name;

        // Match coupe
        if (!normalizedUserCoupe || normalizeCoupeName(tableName) !== normalizedUserCoupe) {
          continue;
        }
        matchedTableCount++;
        if (!primaryTableName) primaryTableName = tableName;

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
            WHERE REGEXP_REPLACE(LOWER(BTRIM(COALESCE(village, ''))), '[[:space:]_-]+', '', 'g') =
                  REGEXP_REPLACE(LOWER(BTRIM($1)), '[[:space:]_-]+', '', 'g')
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

      if (matchedTableCount === 0) {
        coupeMismatchCount++;
        console.log(`[ndvi-scheduler] User ${user_id} skipped: no ${monthLabel} table matched coupe "${coupe_name}".`);
        continue;
      }

      if (totalChanges === 0) {
        // No live records right now (e.g. table re-uploaded / village renamed).
        // Don't stop notifying: re-send the latest successful summary for this
        // month from ANY previous day/slot so the user keeps getting all
        // 3 months x 3 slots = 9 notifications daily.
        const previousNotifications = await queryWithRetry(client, `
          SELECT change_count, village_name, coupe_name
          FROM public.ndvi_daily_notification_log
          WHERE user_id = $1
            AND change_month = $2
            AND change_count > 0
          ORDER BY sent_at DESC
          LIMIT 1
        `, {
          bind: [user_id, monthPrefix.slice(0, 7)],
          type: sequelize.QueryTypes.SELECT
        });

        if (previousNotifications.length === 0) {
          noRecordsCount++;
          console.log(`[ndvi-scheduler] User ${user_id} skipped: no records matched village "${village_name}" in ${matchedTableCount} coupe table(s) for ${monthLabel}, and no earlier notification exists for that month.`);
          continue;
        }

        totalChanges = Number(previousNotifications[0].change_count) || 0;
        notificationVillage = previousNotifications[0].village_name || village_name;
        notificationCoupe = previousNotifications[0].coupe_name || coupe_name;
        repeatedNotification = true;
        repeatedNotificationCount++;
      }

      // ------------------------------------------------
      // 4️⃣ Send ONE summary Firebase notification
      // ------------------------------------------------
      // Unique tag per day + slot + month so the device shows every one of
      // the 9 daily notifications instead of replacing earlier ones.
      const notificationTag = isAdHoc
        ? `ndvi_${opts.reason || 'evt'}_${Date.now()}_${monthPrefix.slice(0, 7)}`
        : `ndvi_${date}_s${slot}_${monthPrefix.slice(0, 7)}`;
      const message = {
        token: firebase_token,
        notification: {
          title: `NDVI Alert 🌿 — ${totalChanges} change(s) detected`,
          body: `${totalChanges} vegetation change(s) detected in ${notificationVillage} for ${monthLabel}. Tap to view details.`
        },
        android: {
          priority: 'high',
          notification: { tag: notificationTag }
        },
        apns: {
          headers: { 'apns-collapse-id': notificationTag, 'apns-priority': '10' }
        },
        data: {
          type: 'ndvi_summary',
          user_id,
          village_name: notificationVillage,
          coupe_name: notificationCoupe,
          table_name: primaryTableName,
          total_changes: String(totalChanges),
          notification_date: date,
          notification_slot: String(slot),
          change_month: monthPrefix,
          change_month_label: monthLabel,
          notification_tag: notificationTag
        }
      };

      try {
        await withTimeout(admin.messaging().send(message), 30 * 1000, 'FCM send (fcm.googleapis.com)');
        notificationsSent++;

        // Log the daily notification
        await queryWithRetry(client, `
          INSERT INTO public.ndvi_daily_notification_log
          (user_id, notification_date, notification_slot, change_count, sent_at, village_name, coupe_name, change_month)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)
          ON CONFLICT (user_id, notification_date, notification_slot, change_month) DO UPDATE SET
            change_count = EXCLUDED.change_count,
            sent_at = CURRENT_TIMESTAMP,
            village_name = EXCLUDED.village_name,
            coupe_name = EXCLUDED.coupe_name,
            change_month = EXCLUDED.change_month
        `, {
          bind: [user_id, date, slot, totalChanges, notificationVillage, notificationCoupe, monthPrefix.slice(0, 7)],
          type: sequelize.QueryTypes.INSERT
        });

        console.log(`[ndvi-scheduler] ${repeatedNotification ? 'Repeated' : 'Sent'} summary notification to user ${user_id}: ${totalChanges} changes in ${notificationVillage} for ${monthLabel}`);

      } catch (err) {
        firebaseFailureCount++;
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
          (err.errorInfo && err.errorInfo.code === "messaging/registration-token-not-registered") ||
          (err.message && (
            err.message.includes("Requested entity was not found") ||
            err.message.includes("NotRegistered")
          ));

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

    console.log(`[ndvi-scheduler] Daily slot ${slot} run completed (${monthLabel}). ${notificationsSent} sent (${repeatedNotificationCount} repeated from today's latest successful notification); ${coupeMismatchCount} coupe mismatch; ${noRecordsCount} without matching village records or prior notification; ${firebaseFailureCount} Firebase failure(s).`);
  } catch (err) {
    console.error(`[ndvi-scheduler] Scheduler error for ${month && month.label}:`, err);
  }
}

// Table whose columns / rows are dumped at server start. Override with env NDVI_DIAG_TABLE.
const DIAG_TABLE = process.env.NDVI_DIAG_TABLE || '2026-07-01_aravalli_coupe_NDVI_Change';
const DIAG_TOTAL_TIMEOUT_MS = 5 * 60 * 1000;

/** Reject if `promise` doesn't settle within `ms` (prevents silent hangs). */
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * READ-ONLY startup diagnostics. Logs every reason a subscribed user would NOT
 * receive an NDVI notification (Firebase, missing tables, token, coupe/village
 * mismatch) and dumps all columns + sample rows of DIAG_TABLE. Sends nothing.
 * Every step has a timeout and everything is logged to stdout (backend-out.log).
 */
async function logStartupDiagnostics(admin, client) {
  const tag = '[ndvi-diag]';
  const SELECT = sequelize.QueryTypes.SELECT;
  const issues = [];
  const addIssue = (msg) => { issues.push(msg); console.log(`${tag} ISSUE: ${msg}`); };
  const villageMatchSql = `REGEXP_REPLACE(LOWER(BTRIM(COALESCE(village, ''))), '[[:space:]_-]+', '', 'g') =
                           REGEXP_REPLACE(LOWER(BTRIM($1)), '[[:space:]_-]+', '', 'g')`;
  const q = (sql, opts, label, ms = 60 * 1000) => withTimeout(queryWithRetry(client, sql, opts), ms, label);

  console.log(`${tag} ================ NDVI notification diagnostics (server start) ================`);

  // 1) Firebase credential
  const proxyVars = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'GLOBAL_AGENT_HTTPS_PROXY']
    .filter(k => process.env[k]).map(k => `${k}=${process.env[k]}`);
  console.log(`${tag} Step 1/4: checking Firebase credential (20s timeout). Proxy env: ${proxyVars.length ? proxyVars.join(', ') : 'none'}`);
  try {
    const cred = admin.app().options.credential;
    if (!cred) throw new Error('Firebase app initialised without a credential');
    await withTimeout(cred.getAccessToken(), 20 * 1000, 'Firebase getAccessToken (oauth2.googleapis.com)');
    console.log(`${tag} Firebase credential: OK`);
  } catch (e) {
    addIssue(`Firebase credential problem: ${e.message}`);
  }

  // 2) NDVI Change tables for each of the last 3 months
  console.log(`${tag} Step 2/4: listing NDVI Change tables for the last 3 months...`);
  const months = getPreviousMonths();
  const tablesByMonth = {};
  for (const m of months) {
    tablesByMonth[m.prefix] = [];
    try {
      const rows = await q(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE '${m.prefix}%_NDVI_Change'
        ORDER BY table_name
      `, { type: SELECT }, `Listing ${m.label} tables`);
      tablesByMonth[m.prefix] = rows.map(r => r.table_name ?? r.TABLE_NAME ?? Object.values(r)[0]).filter(Boolean);
      console.log(`${tag} ${m.label}: ${rows.length} NDVI Change table(s)${rows.length ? ' -> ' + tablesByMonth[m.prefix].join(', ') : ''}`);
      if (!rows.length) addIssue(`No NDVI Change tables for ${m.label} (expected names starting with "${m.prefix}")`);
    } catch (e) {
      addIssue(`Listing NDVI tables for ${m.label} failed: ${e.message}`);
    }
  }

  // 3) Subscribers and per-user match checks
  console.log(`${tag} Step 3/4: checking subscribers in ndvi_notification_users...`);
  let users = [];
  try {
    users = await q(`
      SELECT user_id, firebase_token, village_name, coupe_name
      FROM public.ndvi_notification_users
      ORDER BY user_id
    `, { type: SELECT }, 'Reading ndvi_notification_users');
  } catch (e) {
    addIssue(`Reading public.ndvi_notification_users failed: ${e.message}`);
  }
  console.log(`${tag} Subscribers: ${users.length} total, ${users.filter(u => u.firebase_token).length} with a Firebase token`);
  if (!users.length) addIssue('ndvi_notification_users is empty — nobody is subscribed');

  for (const u of users) {
    const who = `user ${u.user_id} (village="${u.village_name || ''}", coupe="${u.coupe_name || ''}")`;
    if (!u.firebase_token) { addIssue(`${who}: firebase_token is NULL — cannot receive push`); continue; }
    if (!u.village_name) addIssue(`${who}: village_name is empty`);
    const normCoupe = normalizeCoupeName(u.coupe_name);
    if (!normCoupe) { addIssue(`${who}: coupe_name is empty`); continue; }

    for (const m of months) {
      const matched = tablesByMonth[m.prefix].filter(t => normalizeCoupeName(t) === normCoupe);
      if (!matched.length) {
        addIssue(`${who}: no ${m.label} table matches coupe (normalised "${normCoupe}")`);
        continue;
      }
      if (!u.village_name) continue;
      let count = 0;
      for (const t of matched) {
        try {
          const [r] = await q(
            `SELECT COUNT(*)::int AS c FROM public."${t}" WHERE ${villageMatchSql}`,
            { bind: [u.village_name], type: SELECT }, `Counting village rows in "${t}"`, 30 * 1000);
          count += (r && r.c) || 0;
        } catch (e) {
          addIssue(`${who}: query on "${t}" failed: ${e.message}`);
        }
      }
      if (count) console.log(`${tag} OK ${who}: ${count} change row(s) for ${m.label} in ${matched.join(', ')}`);
      else addIssue(`${who}: 0 rows for this village in ${matched.join(', ')} (${m.label}) — only a previously logged summary can be repeated`);
    }
  }

  // 4) Dump all columns, row count and sample rows of DIAG_TABLE
  console.log(`${tag} Step 4/4: inspecting table "${DIAG_TABLE}"...`);
  try {
    const cols = await q(`
      SELECT ordinal_position AS pos, column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `, { bind: [DIAG_TABLE], type: SELECT }, 'Reading table columns');

    if (!cols.length) {
      addIssue(`Table "${DIAG_TABLE}" does not exist in this database`);
    } else {
      console.log(`${tag} Table "${DIAG_TABLE}" has ${cols.length} column(s):`);
      cols.forEach(col => console.log(`${tag}   ${col.pos}. ${col.column_name}  (${col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type}, nullable=${col.is_nullable})`));
      const [{ c }] = await q(`SELECT COUNT(*)::int AS c FROM public."${DIAG_TABLE}"`, { type: SELECT }, 'Counting table rows');
      console.log(`${tag} Table "${DIAG_TABLE}": ${c} row(s)`);

      // Sample rows — skip geometry columns (unreadable binary).
      const readable = cols.filter(col => col.data_type !== 'USER-DEFINED').map(col => `"${col.column_name}"`);
      if (c && readable.length) {
        const sample = await q(
          `SELECT ${readable.join(', ')} FROM public."${DIAG_TABLE}" LIMIT 5`, { type: SELECT }, 'Reading sample rows');
        console.log(`${tag} First ${sample.length} row(s) of "${DIAG_TABLE}" (geometry columns omitted):`);
        sample.forEach((row, i) => {
          const out = {};
          for (const [k, v] of Object.entries(row)) {
            out[k] = v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v).slice(0, 80) : v;
          }
          console.log(`${tag}   row ${i + 1}: ${JSON.stringify(out)}`);
        });
      }
    }
  } catch (e) {
    addIssue(`Inspecting table "${DIAG_TABLE}" failed: ${e.message}`);
  }

  // 5) Summary (stdout, so it lands in backend-out.log)
  if (issues.length) {
    console.log(`${tag} SUMMARY: ${issues.length} issue(s) found:`);
    issues.forEach((msg, i) => console.log(`${tag}  ${i + 1}. ${msg}`));
  } else {
    console.log(`${tag} SUMMARY: No issues found.`);
  }
  console.log(`${tag} ============================== end diagnostics ==============================`);
}

module.exports = function startNdviScheduler(admin) {

  // ───────────────────────────────────────────────────────────────
  // Server-start run — EVERY time the server starts, send every subscribed
  // user one notification per month for the last 3 months (3 notifications).
  // Deferred 30s so the server binds first, then waits for the DB to be
  // reachable (retries every 30s, up to 10 times) so a slow DB at boot
  // doesn't silently skip the startup notifications.
  // Logged as slot 0 with unique tags, so the scheduled 08:00/13:00/18:00
  // runs neither overwrite the log rows nor replace them on the device.
  // ───────────────────────────────────────────────────────────────
  const STARTUP_DELAY_MS = 30 * 1000;
  const STARTUP_DB_RETRIES = 10;
  const STARTUP_RETRY_MS = 30 * 1000;

  console.log('[ndvi-scheduler] Server-start notifications (last 3 months) deferred by 30s...');
  setTimeout(async () => {
    for (let attempt = 1; attempt <= STARTUP_DB_RETRIES; attempt++) {
      try {
        await sequelize.authenticate();
        try {
          await withTimeout(
            logStartupDiagnostics(admin, sequelize.getQueryInterface().sequelize),
            DIAG_TOTAL_TIMEOUT_MS, 'NDVI diagnostics');
        } catch (diagErr) {
          console.log(`[ndvi-diag] Diagnostics aborted: ${diagErr.message} — continuing with startup notifications.`);
        }
        console.log('[ndvi-scheduler] Running server-start notifications for last 3 months...');
        await runNdviNotifications(admin, { reason: 'startup' });
        return;
      } catch (err) {
        console.error(`[ndvi-scheduler] Server-start run: DB not reachable (attempt ${attempt}/${STARTUP_DB_RETRIES}): ${err.message}`);
        if (/pg_hba\.conf/i.test(err.message || '')) {
          console.error('[ndvi-diag] DB rejected this host via pg_hba.conf — add this server\'s IP for the configured DB/user on the PostgreSQL server, then reload it.');
        }
        if (attempt < STARTUP_DB_RETRIES) {
          await new Promise(r => setTimeout(r, STARTUP_RETRY_MS));
        }
      }
    }
    console.error('[ndvi-scheduler] Server-start notifications skipped: DB unreachable after all retries.');
  }, STARTUP_DELAY_MS);

  // ───────────────────────────────────────────────────────────────
  // Daily 3 times: 08:00, 13:00, 18:00 IST (pinned to Asia/Kolkata so it
  // doesn't drift on a UTC server). Each tick loops over the last 3 months
  // → up to 3 notifications per tick, 9 per user per day. Nothing is
  // de-duplicated away: every tick always sends again.
  // ───────────────────────────────────────────────────────────────
  const cronOpts = { timezone: 'Asia/Kolkata' };

  cron.schedule("0 8 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (08:00 IST) — running 3-month summary loop...');
    await runNdviNotifications(admin);
  }, cronOpts);

  cron.schedule("0 13 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (13:00 IST) — running 3-month summary loop...');
    await runNdviNotifications(admin);
  }, cronOpts);

  cron.schedule("0 18 * * *", async () => {
    console.log('[ndvi-scheduler] Cron tick (18:00 IST) — running 3-month summary loop...');
    await runNdviNotifications(admin);
  }, cronOpts);

  console.log('[ndvi-scheduler] Scheduler registered. Startup run deferred 30s. Cron: daily at 08:00, 13:00, 18:00 IST × last 3 months.');
};

// Event-triggered per-user send (login / subscribe / village update).
module.exports.sendNdviNotificationsForUser = sendNdviNotificationsForUser;
