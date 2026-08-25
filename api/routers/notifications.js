const express = require('express');
const multer = require('multer');
const admin = require("firebase-admin");
const { DATE } = require('sequelize');
const { sequelize } = require('../config/r_quire');
const router = express.Router();
const upload = multer();
const { verifyJwt } = require("../middlewares/verifyJwt"); 
const blacklistedTokens = require("../middlewares/tokenBlacklist");
const { logFromRequest } = require("../utils/auditLogger");
const { ensurePixleIdColumn } = require("../utils/ensurePixleId");
const MongoImage = require("../models/Image");

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
      options.bind = Array.isArray(params) ? params : [params];
    }
    const result = await sequelize.query(sql, options);
    // Normalize to { rows: [...] }
    // SELECT → result[0] is array of rows
    // INSERT/UPDATE/DELETE/RAW → result[0] may be null, a number, or an array
    let rows;
    if (Array.isArray(result[0])) {
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
// 8. Send pending notifications from PREVIOUS month(s)
//    Called when a user logs in during the current month.
//    Finds NDVI tables from the previous month, checks which
//    notifications the user hasn't received yet, and sends them.
// ----------------------------------------------------

/**
 * Calculates the previous month's date prefix (YYYY-MM-01).
 * @param {Date} refDate - reference date (defaults to now)
 * @returns {{prevMonthStart: string, prevMonthLabel: string, prevMonthDate: string}}
 */
function getPreviousMonthInfo(refDate = new Date()) {
  const prevMonth = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const yyyy = prevMonth.getFullYear();
  const mm = String(prevMonth.getMonth() + 1).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-01`;
  const label = prevMonth.toLocaleString('default', { month: 'long' }).toUpperCase();
  return { prevMonthStart: dateStr, prevMonthLabel: label, prevMonthDate: dateStr };
}

/**
 * Sends all pending NDVI notifications from the previous month to a user.
 * A "pending" notification is one that exists in a previous-month NDVI table
 * but has no entry in ndvi_notification_log for this (user_id, table_name, pixel_id).
 *
 * @param {string} userId - the user's ID (username)
 * @param {string} firebaseToken - FCM token to send to
 * @returns {Promise<{sent: number, skipped: number, errors: number}>}
 */
async function sendPendingNotificationsFromPreviousMonth(userId, firebaseToken) {
  const result = { sent: 0, skipped: 0, errors: 0, details: [] };

  if (!userId || !firebaseToken) {
    console.warn('[pending-notifications] Missing userId or firebaseToken');
    return result;
  }

  try {
    // 1) Get the user's subscription (village_name, coupe_name)
    const userRows = await client.query(
      `SELECT user_id, firebase_token, village_name, coupe_name
       FROM public.ndvi_notification_users
       WHERE user_id = $1`,
      [userId]
    );

    if (userRows.rows.length === 0) {
      return result;
    }

    const user = userRows.rows[0];

    // Use the latest firebase_token passed in (may be newer than stored)
    const token = firebaseToken || user.firebase_token;
    if (!token) {
      return result;
    }

    const { prevMonthStart, prevMonthLabel } = getPreviousMonthInfo();

    // 2) Find NDVI tables from the previous month
    //    Table naming pattern: YYYY-MM-DD_<coupe>_NDVI_Change
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '${prevMonthStart}%_NDVI_Change'
    `);

    if (tables.rows.length === 0) {
      return result;
    }


    // 3) For each table, find pending notifications for this user
    for (const t of tables.rows) {
      const tableName = t.table_name;

      // Match the user's coupe name
      if (user.coupe_name && !tableName.toUpperCase().includes(`_${user.coupe_name.toUpperCase()}_NDVI_CHANGE`)) {
        continue;
      }

      // Ensure the table has a `pixle_id` column before we SELECT it.
      // Auto-created NDVI tables may lack it; we add + populate unique values
      // (not a primary key) when missing. Idempotent & cheap.
      try {
        await ensurePixleIdColumn(client, tableName);
      } catch (ensureErr) {
        console.error(`[pending-notifications] ensurePixleId failed for "${tableName}":`, ensureErr.message);
        result.errors++;
        continue;
      }

      // Get NDVI change records for the user's village
      let records;
      try {
        records = await client.query(`
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
          LIMIT 10
        `, [user.village_name]);
      } catch (qErr) {
        console.error(`[pending-notifications] Query failed for table "${tableName}":`, qErr.message);
        result.errors++;
        continue;
      }

      if (records.rows.length === 0) continue;

      for (const record of records.rows) {
        const pixelId = String(record.pixle_id);
        // Check if already sent
        const alreadySent = await client.query(`
          SELECT 1
          FROM public.ndvi_notification_log
          WHERE user_id = $1
            AND table_name = $2
            AND pixel_id = $3
          LIMIT 1
        `, [userId, tableName, pixelId]);

        if (alreadySent.rows.length > 0) {
          result.skipped++;
          continue;
        }

        // Build notification message
        let title = `NDVI Alert for ${prevMonthLabel}`;
        let body = `Vegetation change detected in ${user.village_name}`;

        switch (record.change_category) {
          case 'significant_decrease':
            title = `ðŸš¨ Significant Vegetation Decrease â€” ${prevMonthLabel}`;
            body = `NDVI dropped significantly in ${user.village_name}`;
            break;
          case 'moderate_decrease':
            title = `âš ï¸ Moderate Vegetation Decrease â€” ${prevMonthLabel}`;
            body = `NDVI decreased in ${user.village_name}`;
            break;
          case 'significant_increase':
            title = `ðŸŒ± Significant Vegetation Improvement â€” ${prevMonthLabel}`;
            body = `NDVI improved significantly in ${user.village_name}`;
            break;
          case 'moderate_increase':
            title = `ðŸ“ˆ Moderate Vegetation Improvement â€” ${prevMonthLabel}`;
            body = `NDVI improved in ${user.village_name}`;
            break;
        }

        const message = {
          token,
          notification: { title, body },
          data: {
            pixle_id: String(pixelId),
            village_name: String(user.village_name || ''),
            coupe_name: String(user.coupe_name || ''),
            latitude: String(record.latitude || ''),
            longitude: String(record.longitude || ''),
            ndvi_change: String(record.NDVI_change || ''),
            change_category: String(record.change_category || ''),
            table_name: tableName,
            month: prevMonthStart,
          },
        };

        try {
          await admin.messaging().send(message);

          // Log it
          await client.query(`
            INSERT INTO public.ndvi_notification_log (user_id, table_name, pixel_id, sent_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
          `, [userId, tableName, pixelId]);

          result.sent++;
          result.details.push({ table: tableName, pixel_id: pixelId, category: record.change_category });
        } catch (sendErr) {
          console.error(`[pending-notifications] âŒ Firebase send error:`, sendErr.message);
          result.errors++;

          // Clear invalid token
          const isInvalidToken =
            sendErr.code === 'messaging/registration-token-not-registered' ||
            sendErr.code === 'messaging/invalid-registration-token' ||
            (sendErr.message && sendErr.message.includes('Requested entity was not found'));

          if (isInvalidToken) {
            try {
              await client.query(
                `UPDATE public.ndvi_notification_users SET firebase_token = NULL WHERE user_id = $1`,
                [userId]
              );
            } catch (e) { /* ignore */ }
            break; // no point continuing with an invalid token
          }
        }
      }
    }

    return result;
  } catch (err) {
    console.error('[pending-notifications] Error:', err.message);
    result.errors++;
    return result;
  }
}

// Endpoint: manually trigger pending notifications for a user
// POST /api/send-pending-notifications
// Body: { user_id, firebase_token }
router.post('/send-pending-notifications', verifyJwt, upload.none(), async (req, res) => {
  try {
    const user_id = (req.body.user_id || '').trim();
    const firebase_token = (req.body.firebase_token || '').trim();

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // If no firebase_token in request, try to get it from stored subscription
    let token = firebase_token;
    if (!token) {
      const stored = await client.query(
        'SELECT firebase_token FROM public.ndvi_notification_users WHERE user_id = $1',
        [user_id]
      );
      if (stored.rows.length > 0) {
        token = stored.rows[0].firebase_token;
      }
    }

    if (!token) {
      return res.json({
        success: true,
        message: 'No firebase token available â€” user not subscribed or token cleared',
        sent: 0,
      });
    }

    const result = await sendPendingNotificationsFromPreviousMonth(user_id, token);

    logFromRequest(req, {
      action: 'PENDING_NOTIFICATIONS_SEND',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'notification',
      details: { sent: result.sent, skipped: result.skipped, errors: result.errors },
    });

    return res.json({
      success: true,
      message: `Sent ${result.sent} pending notification(s) from previous month`,
      ...result,
    });
  } catch (err) {
    console.error('send-pending-notifications error:', err);
    logFromRequest(req, {
      action: 'PENDING_NOTIFICATIONS_SEND',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      errorMessage: err.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to send pending notifications',
    });
  }
});

const getDivisionFromNdviTableName = (tableName) => {
  if (!tableName) return '-';
  return tableName
    .replace(/_coupe_NDVI_Change$/i, '')
    .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getMonthFromNdviTableName = (tableName) => {
  const match = String(tableName || '').match(/^(\d{4})[-_](\d{2})[-_]\d{2}/);
  return match ? `${match[1]}-${match[2]}` : '-';
};

const getDateFromNdviTableName = (tableName) => {
  const match = String(tableName || '').match(/^(\d{4})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z` : null;
};

const DEFAULT_NOTE_TEXT = 'NDVI decrease less than -0.3';

const isRealNote = (note) => {
  if (!note) return false;
  // Normalize: lowercase, trim, collapse multiple spaces
  const normalized = String(note).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  // Ignore the default auto-generated note
  if (normalized === DEFAULT_NOTE_TEXT.toLowerCase()) return false;
  return true;
};

const buildNdviActionText = (record) => {
  const actions = [];
  if (record?.status === true || record?.status === 'true') actions.push('Status updated');
  if (isRealNote(record?.note)) actions.push('Note added');
  if (record?.image_data) actions.push('Image uploaded');
  return actions.length ? actions.join(', ') : 'No action taken';
};

/**
 * Cleans up the default auto-generated note "NDVI decrease less than -0.3"
 * from all NDVI Change tables, setting it to NULL.
 * Also cleans up any note column in ndvi_notification_log if it exists.
 * Runs once per server startup.
 */
// In-memory column cache: tableName -> Map<columnName, dataType>
// Populated lazily and never evicted (tables don't change schema at runtime).
const _columnInfoCache = new Map();

async function getTableColumns(tableName) {
  if (_columnInfoCache.has(tableName)) return _columnInfoCache.get(tableName);
  const columnInfo = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const map = new Map(columnInfo.rows.map(r => [r.column_name, r.data_type]));
  _columnInfoCache.set(tableName, map);
  return map;
}

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

router.get('/ndvi-notification-report', verifyJwt, async (req, res) => {
  try {
    // NOTE: cleanupDefaultNotes() and table setup run once at module startup — NOT here.
    // DDL / bulk UPDATEs in request handlers block the connection pool.

    const reportGeneratedAt = new Date().toISOString();
    const {
      user_id, username, village_name, coupe_name, table_name,
      status, month, division, start_date, end_date,
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

    if (user_id) addCondition('l.user_id = ?', user_id);
    if (username) addCondition('g.username = ?', username);
    if (village_name) addCondition('u.village_name = ?', village_name);
    if (coupe_name) addCondition('u.coupe_name = ?', coupe_name);
    if (table_name) addCondition('l.table_name = ?', table_name);
    if (month) addCondition('l.table_name LIKE ?', `${month}-%`);
    if (division) addCondition('l.table_name ILIKE ?', `%${division.replace(/\s+/g, '_')}%`);
    if (start_date) addCondition('l.sent_at::date >= ?', start_date);
    if (end_date) addCondition('l.sent_at::date <= ?', end_date);

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build paginated query — use $N+1 and $N+2 for LIMIT/OFFSET after filter params
    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const reportQuery = `
      SELECT
        l.id,
        l.user_id,
        g.username,
        u.village_name,
        u.division,
        u.range,
        u.round,
        u.beat,
        l.table_name,
        l.pixel_id,
        COALESCE(l.sent_at, CURRENT_TIMESTAMP) AS sent_at,
        COALESCE(l.sent_at, CURRENT_TIMESTAMP)::text AS sent_at_raw,
        TO_CHAR(COALESCE(l.sent_at, CURRENT_TIMESTAMP), 'DD-MM-YYYY HH24:MI:SS') AS sent_at_formatted
      FROM public.ndvi_notification_log l
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = l.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = l.user_id
      ${whereClause}
      ORDER BY l.sent_at DESC NULLS LAST, l.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const countQuery = `
      SELECT
        COUNT(*)::int AS total_notifications,
        COUNT(DISTINCT l.user_id)::int AS users_received
      FROM public.ndvi_notification_log l
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = l.user_id
      ${whereClause}
    `;

    const optionsQuery = `
      SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.username ORDER BY g.username), NULL) AS usernames,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.village_name ORDER BY u.village_name), NULL) AS villages,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.coupe_name ORDER BY u.coupe_name), NULL) AS coupes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.table_name ORDER BY l.table_name), NULL) AS tables
      FROM public.ndvi_notification_log l
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = l.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = l.user_id
    `;

    const [report, counts, options] = await Promise.all([
      client.query(reportQuery, [...values, pageSize, offset]),
      client.query(countQuery, values),
      client.query(optionsQuery),
    ]);

    const tableRecords = new Map();
    const tableNames = [...new Set(report.rows.map(row => row.table_name).filter(Boolean))];

    if (tableNames.length > 0) {
      // ── OPTIMIZATION: Single bulk MongoDB query for ALL tables ──────────────
      // Build the full set of record IDs across all tables for a single $in query
      const allPixelIdsForMongo = [...new Set(
        report.rows
          .map(r => String(r.pixel_id))
          .filter(Boolean)
          .flatMap(id => {
            const n = Number(id);
            return !Number.isNaN(n) ? [id, n] : [id];
          })
      )];

      // Single MongoDB query for all tables/IDs at once
      const allMongoImages = await MongoImage.find({
        sourceType: 'ndvi',
        coupeName: { $in: tableNames },
        recordId: { $in: allPixelIdsForMongo }
      }).lean();

      // Index mongo images by (coupeName, recordId) for O(1) lookup
      const mongoImageIndex = new Map();
      for (const img of allMongoImages) {
        const key = `${img.coupeName}::${String(img.recordId)}`;
        mongoImageIndex.set(key, true);
      }

      // ── OPTIMIZATION: Use cached column info — one introspection per table ever ──
      // Fetch column info for all uncached tables in parallel
      const uncachedTables = tableNames.filter(t => !_columnInfoCache.has(t));
      if (uncachedTables.length > 0) {
        // Single query to get columns for all uncached tables at once
        const bulkColInfo = await client.query(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
          ORDER BY table_name, ordinal_position
        `, [uncachedTables]);

        // Populate cache for each uncached table
        for (const t of uncachedTables) {
          _columnInfoCache.set(t, new Map());
        }
        for (const row of bulkColInfo.rows) {
          _columnInfoCache.get(row.table_name).set(row.column_name, row.data_type);
        }
      }

      // Process each source table — column info is now from cache (no DB round-trip)
      // Run source table data queries in parallel for maximum throughput
      await Promise.all(tableNames.map(async (sourceTable) => {
        try {
          const pixelIds = [...new Set(report.rows
            .filter(row => row.table_name === sourceTable)
            .map(row => String(row.pixel_id))
            .filter(Boolean))];

          if (pixelIds.length === 0) {
            tableRecords.set(sourceTable, new Map());
            return;
          }

          // Get column info from cache (populated above)
          const sourceColumns = _columnInfoCache.get(sourceTable) || new Map();

          // Build SELECT clause dynamically
          const colOrNull = (name) => sourceColumns.has(name) ? `"${name}"` : 'NULL::text';
          const selectParts = [
            colOrNull('village') + ' AS village',
            sourceColumns.has('note') ? `CASE WHEN btrim("note") = 'NDVI decrease less than -0.3' THEN NULL ELSE "note" END AS note` : 'NULL::text AS note',
            sourceColumns.has('status') ? '"status" AS status' : 'NULL::text AS status',
            sourceColumns.has('latitude') ? '"latitude" AS latitude' : 'NULL::text AS latitude',
            sourceColumns.has('longitude') ? '"longitude" AS longitude' : 'NULL::text AS longitude',
            colOrNull('division') + ' AS src_division',
            colOrNull('range') + ' AS src_range',
            colOrNull('round') + ' AS src_round',
            colOrNull('beat') + ' AS src_beat',
          ];

          // Determine the ID column: prefer pixle_id, fall back to id
          const hasPxCol = sourceColumns.has('pixle_id');
          const hasIdCol = sourceColumns.has('id');
          let idCast;
          if (hasPxCol) {
            idCast = '"pixle_id"::text';
          } else if (hasIdCol) {
            idCast = '"id"::text';
          } else {
            tableRecords.set(sourceTable, new Map());
            return;
          }

          const placeholders = pixelIds.map((_, i) => `$${i + 1}`).join(', ');
          let sourceRows = await client.query(`
            SELECT
              ${idCast} AS pixel_id,
              ${selectParts.join(',\n              ')}
            FROM public."${sourceTable}"
            WHERE ${idCast} IN (${placeholders})
          `, pixelIds);

          // Fallback: try numeric cast for integer pixle_id columns
          if (sourceRows.rows.length === 0 && hasPxCol) {
            const numericIds = pixelIds.map(Number).filter(n => !Number.isNaN(n));
            if (numericIds.length > 0) {
              const numPlaceholders = numericIds.map((_, i) => `$${i + 1}`).join(', ');
              try {
                sourceRows = await client.query(`
                  SELECT
                    "pixle_id"::text AS pixel_id,
                    ${selectParts.join(',\n                    ')}
                  FROM public."${sourceTable}"
                  WHERE "pixle_id" IN (${numPlaceholders})
                `, numericIds);
              } catch (_) { /* column type may not support numeric comparison */ }
            }
          }

          // Use mongo index built above — O(1) lookup per row
          const recordMap = new Map(sourceRows.rows.map(row => [String(row.pixel_id), {
            ...row,
            image_data: mongoImageIndex.has(`${sourceTable}::${String(row.pixel_id)}`)
          }]));
          tableRecords.set(sourceTable, recordMap);
        } catch (err) {
          console.warn(`Failed to read NDVI source table ${sourceTable}: ${err.message}`);
          tableRecords.set(sourceTable, new Map());
        }
      }));
    }

    let annotatedRows = report.rows.map((row) => {
      const sourceRecord = tableRecords.get(row.table_name)?.get(String(row.pixel_id));
      if (!sourceRecord) {
      }
      // Only "Resolved" when there is a real note AND an image
      const hasRealNote = isRealNote(sourceRecord?.note);
      const hasImage = !!sourceRecord?.image_data;
      const alertStatus = (hasRealNote && hasImage) ? 'Resolved' : 'Pending';
      // If Pending, force "No action taken" regardless of status field
      const actionTaken = alertStatus === 'Pending' ? 'No action taken' : buildNdviActionText(sourceRecord);
      const sentAtFallback = row.sent_at || row.sent_at_raw || getDateFromNdviTableName(row.table_name) || reportGeneratedAt;
      return {
        ...row,
        sent_at: sentAtFallback,
        sent_at_raw: row.sent_at_raw || String(sentAtFallback),
        sent_at_formatted: row.sent_at_formatted || new Date(sentAtFallback).toLocaleString('en-GB', { hour12: false }),
        report_generated_at: reportGeneratedAt,
        month: getMonthFromNdviTableName(row.table_name),
        // division/range/round/beat: prefer values from the NDVI change table
        // (matched by pixel_id), fall back to ndvi_notification_users values,
        // then to table-name extraction / '-'.
        division: sourceRecord?.src_division || row.division || getDivisionFromNdviTableName(row.table_name),
        range:    sourceRecord?.src_range    || row.range    || '-',
        round:    sourceRecord?.src_round    || row.round    || '-',
        beat:     sourceRecord?.src_beat     || row.beat     || '-',
        village: sourceRecord?.village || row.village_name || '-',
        alert_status: alertStatus,
        action_taken: actionTaken,
        note: isRealNote(sourceRecord?.note) ? sourceRecord.note : null,
        has_image: !!sourceRecord?.image_data,
        latitude: sourceRecord?.latitude || null,
        longitude: sourceRecord?.longitude || null,
      };
    });

    if (status) {
      annotatedRows = annotatedRows.filter(row => row.alert_status === status);
    }

    const monthlyDivisionMap = new Map();
    annotatedRows.forEach((row) => {
      const key = `${row.month}__${row.division}__${row.range}__${row.round}__${row.beat}__${row.village}`;
      if (!monthlyDivisionMap.has(key)) {
        monthlyDivisionMap.set(key, {
          month: row.month,
          division: row.division,
          range: row.range,
          round: row.round,
          beat: row.beat,
          village: row.village,
          alerts_generated: 0,
          resolved: 0,
          pending: 0
        });
      }
      const item = monthlyDivisionMap.get(key);
      item.alerts_generated += 1;
      if (row.alert_status === 'Resolved') item.resolved += 1;
      else item.pending += 1;
    });

    const optionRows = options.rows[0] || {};
    const tableOptions = optionRows.tables || [];
    const divisionOptions = [...new Set(tableOptions.map(getDivisionFromNdviTableName))].filter(Boolean).sort();
    const monthOptions = [...new Set(tableOptions.map(getMonthFromNdviTableName))].filter(Boolean).sort().reverse();

    const totalCount = counts.rows[0] || { total_notifications: 0, users_received: 0 };

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
        ...totalCount,
        // Note: resolved/pending counts below reflect the current page only.
        // Full counts require a separate query — kept simple for performance.
        resolved: annotatedRows.filter(row => row.alert_status === 'Resolved').length,
        pending: annotatedRows.filter(row => row.alert_status === 'Pending').length,
      },
      monthlyDivisionSummary: Array.from(monthlyDivisionMap.values()).sort((a, b) => b.month.localeCompare(a.month) || a.division.localeCompare(b.division)),
      options: {
        usernames: optionRows.usernames || [],
        villages: optionRows.villages || [],
        coupes: optionRows.coupes || [],
        tables: tableOptions,
        divisions: divisionOptions,
        months: monthOptions,
        statuses: ['Pending', 'Resolved'],
      },
    });
  } catch (err) {
    console.error('ndvi-notification-report error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch NDVI notification report' });
  }
});

// Export the function so it can be called from forestLogin.js
router.sendPendingNotificationsFromPreviousMonth = sendPendingNotificationsFromPreviousMonth;

module.exports = router;

