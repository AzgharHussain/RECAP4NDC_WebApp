const express = require('express');
const multer = require('multer');
const admin = require("firebase-admin");
const { sequelize } = require('../config/r_quire');
const router = express.Router();
const upload = multer();
const { verifyJwt } = require("../middlewares/verifyJwt"); 
const blacklistedTokens = require("../middlewares/tokenBlacklist");
const { logFromRequest } = require("../utils/auditLogger");
const { ensurePixleIdColumn } = require("../utils/ensurePixleId");

// ─────────────────────────────────────────────────────────
// Use a thin adapter that delegates to Sequelize so ALL queries share the
// ONE connection pool (database.js). Replacing the old separate pg.Pool which
// was creating a second pool that fired DDL at module load and blocked startup
// by holding connections for up to 60 s (acquireTimeoutMillis).
// ─────────────────────────────────────────────────────────
const client = {
  /**
   * Executes any SQL via the shared Sequelize pool.
   * Returns { rows: [...] } to match the pg Pool API used throughout this file.
   *
   * Supports:
   *   client.query(sql)           → { rows: [] }
   *   client.query(sql, params)   → { rows: [...] }   (positional $1, $2...)
   */
  query: async (sql, params) => {
    const trimmed = sql.trim().toUpperCase();
    let queryType;
    if (/^SELECT/.test(trimmed)) {
      queryType = sequelize.QueryTypes.SELECT;
    } else if (/^INSERT/.test(trimmed)) {
      queryType = sequelize.QueryTypes.INSERT;
    } else if (/^UPDATE/.test(trimmed)) {
      queryType = sequelize.QueryTypes.UPDATE;
    } else if (/^DELETE/.test(trimmed)) {
      queryType = sequelize.QueryTypes.DELETE;
    } else {
      queryType = sequelize.QueryTypes.RAW;
    }
    const options = { raw: true, type: queryType };
    if (params) {
      // Replace undefined with null — Sequelize's bind throws on undefined values
      const safeParams = (Array.isArray(params) ? params : [params]).map(v => v === undefined ? null : v);
      options.bind = safeParams;
    }
    const result = await sequelize.query(sql, options);
    // Normalize to { rows: [...] }
    // SELECT → result is the array of rows directly (not [rows, metadata])
    // INSERT/UPDATE/DELETE/RAW → result[0] is the rows array (or metadata)
    let rows;
    if (queryType === sequelize.QueryTypes.SELECT) {
      rows = Array.isArray(result) ? result : (result ? [result] : []);
    } else if (Array.isArray(result[0])) {
      rows = result[0];
    } else if (result[0] !== null && result[0] !== undefined) {
      rows = [result[0]];
    } else {
      rows = [];
    }
    return { rows };
  },
};


// ----------------------------------------------------
// 3. NDVI Table Name
// ----------------------------------------------------
const degraded_forest_Layer = `"2026-01-01_aravalli_coupe_NDVI_Change"`;

const degraded_forest_Layer_N=`2026-01-01_aravalli_coupe_NDVI_Change`;
const parts = degraded_forest_Layer.replace(/"/g, '').split('_');
const coupe_name = parts.slice(1, -2).join('_');

const date = degraded_forest_Layer.match(/"(\d{4}-\d{2}-\d{2})_/)[1]; // "2025-02-01"
const dateObj = new Date(date);
const monthFull = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase(); // "FEBRUARY"

// ----------------------------------------------------
// Create notification tables if not exists
// ----------------------------------------------------
async function createNotificationTables() {

  try {

    // users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ndvi_notification_users (
        user_id TEXT PRIMARY KEY,
        firebase_token TEXT,
        village_name TEXT,
        coupe_name TEXT
      )
    `);

    // Add division/range/round/beat columns if they don't exist yet
    const extraCols = ['division', 'range', 'round', 'beat'];
    for (const col of extraCols) {
      await client.query(`
        ALTER TABLE public.ndvi_notification_users
        ADD COLUMN IF NOT EXISTS ${col} TEXT
      `);
    }

    // notification log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ndvi_notification_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        table_name TEXT,
        pixel_id TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, table_name, pixel_id)
      )
    `);

    // Migrate pixel_id to TEXT only if the column is not already TEXT.
    // ALTER COLUMN TYPE causes a full table rewrite + ACCESS EXCLUSIVE lock.
    // Running it unconditionally on every startup hangs the server.
    const pixelIdType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ndvi_notification_log'
        AND column_name = 'pixel_id'
      LIMIT 1
    `);
    if (pixelIdType.rows.length > 0 && pixelIdType.rows[0].data_type !== 'text') {
      await client.query(`
        ALTER TABLE public.ndvi_notification_log
        ALTER COLUMN pixel_id TYPE TEXT USING pixel_id::text
      `);
    }

    // Ensure sent_at column exists and is populated (idempotent)
    await client.query(`
      ALTER TABLE public.ndvi_notification_log
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      UPDATE public.ndvi_notification_log
      SET sent_at = CURRENT_TIMESTAMP
      WHERE sent_at IS NULL
    `);

    // Performance indexes — created once at startup, skipped if already exist
    // Use non-concurrent creation to avoid issues inside transactions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ndvi_log_user_table
      ON public.ndvi_notification_log (user_id, table_name)
    `).catch(() => {});

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ndvi_users_token
      ON public.ndvi_notification_users (firebase_token)
      WHERE firebase_token IS NOT NULL
    `).catch(() => {});

    // Additional indexes for report query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ndvi_log_table_pixel
      ON public.ndvi_notification_log (table_name, pixel_id)
    `).catch(() => {});

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ndvi_log_sent_at
      ON public.ndvi_notification_log (sent_at DESC NULLS LAST)
    `).catch(() => {});

  } catch (err) {

    console.error("❌ Error creating notification tables:", err);

  }

}

// Defer ALL startup DDL to well after the server has bound its port.
// createNotificationTables() runs ALTER TABLE, CREATE INDEX, UPDATE — these
// take exclusive locks and block the pool. Running them at module load time
// (before app.listen) starves other startup code and hangs the server.
console.log('[notifications] Module loaded. Table setup deferred 5s to let server bind first.');
setTimeout(() => {
  createNotificationTables().catch(err => console.error('[notifications] startup table setup failed:', err.message));
  // Run default note cleanup after table setup (30s delay for safety)
  setTimeout(() => {
    cleanupDefaultNotes().catch(err => console.error('[notifications] startup note cleanup failed:', err.message));
  }, 30000);
}, 5000);

// ----------------------------------------------------
// 4. Helper: Send Notification using Firebase Admin
// ----------------------------------------------------
async function sendNotification(firebaseToken, record) {

  const {
    id,
    jan_ndvi,
    feb_ndvi,
    ndvi_change,
    change_category,
    latitude,
    longitude
  } = record;



  // Create title & body
  let title = `NDVI Alert For ${monthFull}`;
  let body = `Coupe Name: ${coupe_name}`;

  switch (change_category) {
    case 'significant_decrease':
      title = '🚨 Significant Vegetation Decrease';
      body = `NDVI dropped from ${jan_ndvi} to ${feb_ndvi}`;
      break;

    case 'moderate_decrease':
      title = '⚠️ Moderate Vegetation Decrease';
      body = `NDVI decreased from ${jan_ndvi} to ${feb_ndvi}`;
      break;

    case 'significant_increase':
      title = '🌱 Significant Vegetation Improvement';
      body = `NDVI increased from ${jan_ndvi} to ${feb_ndvi}`;
      break;

    case 'moderate_increase':
      title = '📈 Moderate Vegetation Improvement';
      body = `NDVI improved from ${jan_ndvi} to ${feb_ndvi}`;
      break;
  }
//  body += ` - ${coupe_name}`;
  const message = {
    token: firebaseToken,
    notification: {
      title,
       body
    },
    data: {
      id: String(id),
      change_category,
      // ndvi_change: String(ndvi_change),
      latitude: String(latitude || ""),
      longitude: String(longitude || ""),
      degraded_forest_Layer_N,
      coupe_name,
      table_name: degraded_forest_Layer,
      village_name: String(record.village_name || record.village || ""),
      date
    }
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (err) {
    return { success: false, error: err.message };
  }
}



// ----------------------------------------------------
// 5. Update notification_sent flag
// ----------------------------------------------------
async function setNotificationSent(id) {
  try {
    await client.query(
      `UPDATE public.${degraded_forest_Layer} SET notification_sent = TRUE WHERE id = $1`,
      [id]
    );
    return true;
  } catch (err) {
    return false;
  }
}



// ----------------------------------------------------
// 6. API: Send NDVI Notifications
// ----------------------------------------------------
router.post("/send-notifications", verifyJwt, upload.none(), async (req, res) => {

  try {


    const firebase_token = (req.body.firebase_token || "").trim();
    const user_id = (req.body.user_id || "").trim();
    const village_name = (req.body.village_name || "").trim();

    // Accept common coupe/coupen name variations sent by clients
    const coupe_name = (
      req.body.coupe_name ||
      req.body.coupenname ||
      req.body.coupename ||
      req.body.coupeName ||
      req.body.coupenName ||
      ""
    ).trim();

    // Extract division/range/round/beat from JWT (set at login from forest API)
    const division = (req.user?.division || req.body.division || "").trim();
    const range    = (req.user?.range    || req.body.range    || "").trim();
    const round    = (req.user?.round    || req.body.round    || "").trim();
    const beat     = (req.user?.beat     || req.body.beat     || "").trim();

    if (!firebase_token || !user_id || !village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        received: { firebase_token: !!firebase_token, user_id: !!user_id, village_name: !!village_name, coupe_name: !!coupe_name },
        bodyKeys: Object.keys(req.body || {})
      });
    }

    // ------------------------------------------------
    // Insert or update user subscription (with division/range/round/beat)
    // NOTE: Columns are guaranteed by createNotificationTables() at startup.
    // DO NOT run ALTER TABLE here — it blocks the connection pool on every call.
    // ------------------------------------------------
    await client.query(
      `
      INSERT INTO public.ndvi_notification_users
        (user_id, firebase_token, village_name, coupe_name, division, range, round, beat)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id)
      DO UPDATE SET
        firebase_token = EXCLUDED.firebase_token,
        village_name   = EXCLUDED.village_name,
        coupe_name     = EXCLUDED.coupe_name,
        division       = COALESCE(NULLIF(EXCLUDED.division, ''), ndvi_notification_users.division),
        range          = COALESCE(NULLIF(EXCLUDED.range,    ''), ndvi_notification_users.range),
        round          = COALESCE(NULLIF(EXCLUDED.round,    ''), ndvi_notification_users.round),
        beat           = COALESCE(NULLIF(EXCLUDED.beat,     ''), ndvi_notification_users.beat)
      `,
      [user_id, firebase_token, village_name, coupe_name, division, range, round, beat]
    );

    logFromRequest(req, {
      action: 'NOTIFICATION_SUBSCRIBE',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'notification',
      details: { village_name, coupe_name },
    });

    res.json({
      success: true,
      message: "Notification subscription saved successfully"
    });

  } catch (err) {

    console.error("Subscription error:", err);

    logFromRequest(req, {
      action: 'NOTIFICATION_SUBSCRIBE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      errorMessage: err.message,
    });

    res.status(500).json({
      success: false,
      message: "An internal error occurred. Please try again later."
    });

  }

});

router.put("/update-notification-user", verifyJwt, upload.none(), async (req, res) => {

  try {

    const firebase_token = (req.body.firebase_token || "").trim();
    const user_id = (req.body.user_id || "").trim();
    const village_name = (req.body.village_name || "").trim();
    const coupe_name = (req.body.coupe_name || "").trim();

    if (!firebase_token || !user_id || !village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters"
      });
    }

    const result = await client.query(
      `UPDATE ndvi_notification_users
       SET firebase_token = $1,
           village_name = $2,
           coupe_name = $3
       WHERE user_id = $4
       RETURNING *`,
      [firebase_token, village_name, coupe_name, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    logFromRequest(req, {
      action: 'NOTIFICATION_UPDATE',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'notification',
    });

    res.json({
      success: true,
      message: "Notification user updated successfully",
      data: result.rows[0]
    });

  } catch (err) {

    console.error("Update error:", err);

    logFromRequest(req, {
      action: 'NOTIFICATION_UPDATE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      errorMessage: err.message,
    });

    res.status(500).json({
      success: false,
      message: "An internal error occurred. Please try again later."
    });

  }

});


// ----------------------------------------------------
// 7. Test FCM with simple message
// ----------------------------------------------------
router.post("/test-fcm", verifyJwt,upload.none(), async (req, res) => {
  try {
    const firebase_token = (req.body.firebase_token || "").trim();

    if (!firebase_token) {
      return res.status(400).json({ success: false, error: "firebase_token required" });
    }

    const message = {
      token: firebase_token,
      notification: {
        title: "Test Notification",
        body: "This is a test FCM message"
      }
    };

    const response = await admin.messaging().send(message);

    res.json({
      success: true,
      messageId: response
    });

  } catch (err) {
    console.error("FCM test error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send test notification. Please check the firebase token."
    });
  }
});


// ----------------------------------------------------
// 7b. Send NDVI summary notification on demand
//     POST /api/send-notification
//     Body: { user_id, firebase_token }
//     Looks up the user's village_name + coupe_name, finds the last
//     month's NDVI Change table(s) for that coupe, counts the village's
//     changes, and sends ONE summary notification with table_name and
//     village_name in the background data payload. When the user taps
//     the notification, the client calls GET /api/ndvi-changes/village
//     with those two values to fetch the village's records.
// ----------------------------------------------------
router.post("/send-notification", verifyJwt, upload.none(), async (req, res) => {
  try {
    // Coerce to string safely — client may send JSON where user_id is a number
    // or send multipart form data. Handles both without throwing.
    const user_id = (req.body.user_id != null ? String(req.body.user_id) : "").trim();
    const firebase_token = (req.body.firebase_token != null ? String(req.body.firebase_token) : "").trim();

    if (!user_id || !firebase_token) {
      return res.status(400).json({
        success: false,
        message: "user_id and firebase_token are required",
      });
    }

    // 1) Look up the user's subscription (village_name, coupe_name)
    const userRows = await client.query(
      `SELECT user_id, firebase_token, village_name, coupe_name
       FROM public.ndvi_notification_users
       WHERE user_id = $1`,
      [user_id]
    );

    if (userRows.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User subscription not found. Subscribe first via /send-notifications.",
      });
    }

    const user = userRows.rows[0];
    const village_name = user.village_name;
    const coupe_name = user.coupe_name;

    if (!village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "User has no village_name or coupe_name set in subscription",
      });
    }

    // 2) Find NDVI Change tables matching this coupe
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%_NDVI_Change'
        AND UPPER(table_name) LIKE UPPER($1)
      ORDER BY table_name DESC
    `, [`%_${coupe_name}_NDVI_Change%`]);

    if (tables.rows.length === 0) {
      return res.json({
        success: true,
        message: "No NDVI Change tables found for this coupe",
        sent: 0,
      });
    }

    // 3) Count changes for this village across matching tables and
    //    pick the first (most recent) table that has changes as the
    //    primary table_name for the notification payload.
    let totalChanges = 0;
    let primaryTableName = '';

    for (const t of tables.rows) {
      const tableName = t.table_name;

      try {
        await ensurePixleIdColumn(client, tableName);
      } catch (ensureErr) {
        console.error(`[send-notification] ensurePixleId failed for "${tableName}":`, ensureErr.message);
        continue;
      }

      let records;
      try {
        records = await client.query(`
          SELECT pixle_id
          FROM public."${tableName}"
          WHERE village = $1
        `, [village_name]);
      } catch (qErr) {
        console.error(`[send-notification] Query failed for table "${tableName}":`, qErr.message);
        continue;
      }

      if (records.rows.length > 0) {
        totalChanges += records.rows.length;
        if (!primaryTableName) primaryTableName = tableName;
      }
    }

    if (totalChanges === 0) {
      return res.json({
        success: true,
        message: "No NDVI changes found for this village",
        sent: 0,
      });
    }

    // 4) Send ONE summary notification with table_name + village_name in background
    const message = {
      token: firebase_token,
      notification: {
        title: `NDVI Alert 🌿 — ${totalChanges} change(s) detected`,
        body: `${totalChanges} vegetation change(s) detected in ${village_name}. Tap to view details.`
      },
      data: {
        type: 'ndvi_summary',
        user_id,
        village_name,
        coupe_name,
        table_name: primaryTableName,
        total_changes: String(totalChanges),
      },
    };

    try {
      const response = await admin.messaging().send(message);

      logFromRequest(req, {
        action: 'SEND_NOTIFICATION',
        status: 'SUCCESS',
        statusCode: 200,
        userId: user_id,
        resourceType: 'notification',
        details: { village_name, coupe_name, table_name: primaryTableName, total_changes: totalChanges },
      });

      return res.json({
        success: true,
        message: `Notification sent: ${totalChanges} change(s) in ${village_name}`,
        messageId: response,
        sent: 1,
        table_name: primaryTableName,
        village_name,
        total_changes: totalChanges,
      });
    } catch (sendErr) {
      console.error('[send-notification] Firebase send error:', sendErr.message);

      // Clear invalid token
      const isInvalidToken =
        sendErr.code === 'messaging/registration-token-not-registered' ||
        sendErr.code === 'messaging/invalid-registration-token' ||
        (sendErr.message && sendErr.message.includes('Requested entity was not found'));

      if (isInvalidToken) {
        try {
          await client.query(
            `UPDATE public.ndvi_notification_users SET firebase_token = NULL WHERE user_id = $1`,
            [user_id]
          );
        } catch (e) { /* ignore */ }
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: sendErr.message,
      });
    }
  } catch (err) {
    console.error('send-notification error:', err);

    logFromRequest(req, {
      action: 'SEND_NOTIFICATION',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      errorMessage: err.message,
    });

    return res.status(500).json({
      success: false,
      message: 'An internal error occurred. Please try again later.',
    });
  }
});

router.post('/logout',verifyJwt ,async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(400).json({ message: "Token required" });
    }

    const token = authHeader.split(' ')[1];

    
    const { user_id } = req.body;

    const query = `
      DELETE FROM ndvi_notification_users
      WHERE user_id = $1
      RETURNING *;
    `;

    const values = [user_id];

    const result = await client.query(query, values);


    // Add token to blacklist
    blacklistedTokens.add(token);

    logFromRequest(req, {
      action: 'LOGOUT',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'user_session',
    });

    return res.json({
      message: "Logged out successfully",
      deletedUser: result.rows[0] || null
    });

  } catch (error) {
    console.error("Logout error:", error);

    logFromRequest(req, {
      action: 'LOGOUT_FAILED',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      errorMessage: error.message,
    });
    return res.status(500).json({ message: "Server error" });
  }
});



// ----------------------------------------------------
// 8. Per-pixel pending notifications REMOVED.
//    Notifications are now sent only as a daily summary (3x/day)
//    by the NDVI scheduler, which includes the last month's
//    table_name and village_name in the notification data payload.
//    The scheduler also runs once on server startup.
// ----------------------------------------------------

const DEFAULT_NOTE_TEXT = 'NDVI decrease less than -0.3';

/**
 * Cleans up the default auto-generated note "NDVI decrease less than -0.3"
 * from all NDVI Change tables, setting it to NULL.
 * Also cleans up any note column in ndvi_notification_log if it exists.
 * Runs once per server startup.
 */
let defaultNoteCleanupDone = false;
async function cleanupDefaultNotes() {
  if (defaultNoteCleanupDone) return;
  defaultNoteCleanupDone = true;
  try {
    // 1. Clean up NDVI Change tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name LIKE '%_NDVI_Change'
      ORDER BY table_name
    `);
    let cleanedTables = 0;
    for (const { table_name } of tables.rows) {
      try {
        // Check if the table has a note column
        const colCheck = await client.query(`
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'note'
        `, [table_name]);
        if (colCheck.rows.length === 0) continue;

        const result = await client.query(`
          UPDATE public."${table_name}"
          SET note = NULL
          WHERE btrim(note) = $1
        `, [DEFAULT_NOTE_TEXT]);
        if (result.rowCount > 0) {
          cleanedTables += 1;
        }
      } catch (err) {
        // Skip tables that error out
      }
    }
    if (cleanedTables > 0) {
      console.log(`[notifications] Cleaned default note from ${cleanedTables} NDVI Change table(s).`);
    }

    // 2. Clean up ndvi_notification_log if it has a note column
    const logColCheck = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ndvi_notification_log' AND column_name = 'note'
    `);
    if (logColCheck.rows.length > 0) {
      const logResult = await client.query(`
        UPDATE public.ndvi_notification_log
        SET note = NULL
        WHERE btrim(note) = $1
      `, [DEFAULT_NOTE_TEXT]);
      if (logResult.rowCount > 0) {
        console.log(`[notifications] Cleaned default note from ${logResult.rowCount} ndvi_notification_log row(s).`);
      }
    }
  } catch (err) {
    console.error('[notifications] Failed to cleanup default notes:', err.message);
  }
}

// ----------------------------------------------------
// 9. NDVI Notification Report (daily summary model)
//    Queries ndvi_daily_notification_log (the new daily
//    summary table written by the scheduler 3x/day) and
//    joins it with ndvi_notification_users and
//    government_department_users for display.
// ----------------------------------------------------
const SLOT_LABELS = { 1: 'Morning (08:00)', 2: 'Afternoon (13:00)', 3: 'Evening (18:00)' };

router.get('/ndvi-notification-report', verifyJwt, async (req, res) => {
  try {
    const {
      user_id, username, village_name, coupe_name,
      month, division, start_date, end_date,
      page: pageParam, pageSize: pageSizeParam
    } = req.query;

    // Server-side pagination — default 500 rows per page
    const pageSize = Math.min(Math.max(parseInt(pageSizeParam) || 500, 1), 2000);
    const page = Math.max(parseInt(pageParam) || 1, 1);
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const values = [];

    const addCondition = (sql, value) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    if (user_id) addCondition('d.user_id = ?', user_id);
    if (username) addCondition('g.username = ?', username);
    if (village_name) addCondition('u.village_name = ?', village_name);
    if (coupe_name) addCondition('u.coupe_name = ?', coupe_name);
    if (division) addCondition('u.division ILIKE ?', `%${division}%`);
    if (month) addCondition("TO_CHAR(d.notification_date, 'YYYY-MM') = ?", month);
    if (start_date) addCondition('d.notification_date >= ?', start_date);
    if (end_date) addCondition('d.notification_date <= ?', end_date);

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build paginated query — use $N+1 and $N+2 for LIMIT/OFFSET after filter params
    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const reportQuery = `
      SELECT
        d.id,
        d.user_id,
        g.username,
        u.village_name,
        u.coupe_name,
        u.division,
        u.range,
        u.round,
        u.beat,
        d.notification_date,
        d.notification_slot,
        d.change_count,
        d.sent_at,
        TO_CHAR(d.sent_at, 'DD-MM-YYYY HH24:MI:SS') AS sent_at_formatted
      FROM public.ndvi_daily_notification_log d
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = d.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = d.user_id
      ${whereClause}
      ORDER BY d.sent_at DESC NULLS LAST, d.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const countQuery = `
      SELECT
        COUNT(*)::int AS total_notifications,
        COUNT(DISTINCT d.user_id)::int AS users_received,
        COALESCE(SUM(d.change_count), 0)::int AS total_changes
      FROM public.ndvi_daily_notification_log d
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = d.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = d.user_id
      ${whereClause}
    `;

    const optionsQuery = `
      SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.username ORDER BY g.username), NULL) AS usernames,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.village_name ORDER BY u.village_name), NULL) AS villages,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.coupe_name ORDER BY u.coupe_name), NULL) AS coupes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.division ORDER BY u.division), NULL) AS divisions
      FROM public.ndvi_daily_notification_log d
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = d.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = d.user_id
    `;

    const monthOptionsQuery = `
      SELECT DISTINCT TO_CHAR(notification_date, 'YYYY-MM') AS month
      FROM public.ndvi_daily_notification_log
      ORDER BY month DESC
    `;

    const [report, counts, options, monthRows] = await Promise.all([
      client.query(reportQuery, [...values, pageSize, offset]),
      client.query(countQuery, values),
      client.query(optionsQuery),
      client.query(monthOptionsQuery),
    ]);

    // Annotate rows with readable slot labels and month
    const annotatedRows = report.rows.map((row) => ({
      ...row,
      notification_date: row.notification_date ? new Date(row.notification_date).toISOString().slice(0, 10) : null,
      slot_label: SLOT_LABELS[row.notification_slot] || `Slot ${row.notification_slot}`,
      month: row.notification_date ? String(row.notification_date).slice(0, 7) : '-',
      village: row.village_name || '-',
    }));

    // Monthly division-wise summary
    const monthlyDivisionMap = new Map();
    annotatedRows.forEach((row) => {
      const key = `${row.month}__${row.division || '-'}__${row.range || '-'}__${row.round || '-'}__${row.beat || '-'}__${row.village}`;
      if (!monthlyDivisionMap.has(key)) {
        monthlyDivisionMap.set(key, {
          month: row.month,
          division: row.division || '-',
          range: row.range || '-',
          round: row.round || '-',
          beat: row.beat || '-',
          village: row.village,
          alerts_generated: 0,
          notifications_sent: 0,
        });
      }
      const item = monthlyDivisionMap.get(key);
      item.alerts_generated += row.change_count || 0;
      item.notifications_sent += 1;
    });

    const optionRows = options.rows[0] || {};
    const monthOptions = monthRows.rows.map(r => r.month).filter(Boolean);

    const totalCount = counts.rows[0] || { total_notifications: 0, users_received: 0, total_changes: 0 };

    res.json({
      success: true,
      data: annotatedRows,
      pagination: {
        page,
        pageSize,
        total: totalCount.total_notifications,
        totalPages: Math.ceil(totalCount.total_notifications / pageSize),
      },
      summary: {
        total_notifications: totalCount.total_notifications,
        users_received: totalCount.users_received,
        total_changes: totalCount.total_changes,
      },
      monthlyDivisionSummary: Array.from(monthlyDivisionMap.values()).sort((a, b) => b.month.localeCompare(a.month) || a.division.localeCompare(b.division)),
      options: {
        usernames: optionRows.usernames || [],
        villages: optionRows.villages || [],
        coupes: optionRows.coupes || [],
        divisions: optionRows.divisions || [],
        months: monthOptions,
      },
    });
  } catch (err) {
    console.error('ndvi-notification-report error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch NDVI notification report' });
  }
});

module.exports = router;

