const express = require('express');
const { Pool } = require('pg');
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


// ----------------------------------------------------
// 2. Postgres Connection Pool
// ----------------------------------------------------
const client = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL_MAX || 50),
  min: 5,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
});

client.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});




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

    await client.query(`
      ALTER TABLE public.ndvi_notification_log
      ALTER COLUMN pixel_id TYPE TEXT USING pixel_id::text
    `);


  } catch (err) {

    console.error("❌ Error creating notification tables:", err);

  }

}

// run once
createNotificationTables();

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
// router.post("/send-notifications", verifyJwt, upload.none(), async (req, res) => {

//   try {

//     const firebase_token = (req.body.firebase_token || "").trim();
//     const user_id = (req.body.user_id || "").trim();
//     const village_name = (req.body.village_name || "").trim();
//     const coupe_name = (req.body.coupe_name || "").trim();

//     if (!firebase_token || !user_id || !village_name || !coupe_name) {
//       return res.status(400).json({
//         success: false,
//         message: "invalid request"
//       });
//     }

//     // ------------------------------------------------
//     // Generate NDVI Table Name
//     // ------------------------------------------------
//     const degraded_forest_Layer = `"2026-01-01_${coupe_name}_NDVI_Change"`;

//     // month extraction
//     const date = "2026-01-01";
//     const dateObj = new Date(date);
//     const monthFull = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase();

//     // ------------------------------------------------
//     // Query NDVI record
//     // ------------------------------------------------
//     const q = `
//       SELECT
//         pixle_id as id,
//         "Dec_NDVI" as jan_ndvi,
//         "Jan_NDVI" as feb_ndvi,
//         "NDVI_change" as ndvi_change,
//         change_category,
//         longitude,
//         latitude
//       FROM public.${degraded_forest_Layer}
//       WHERE village = $1
//       AND notification_sent = FALSE
//       ORDER BY "NDVI_change" DESC
//       LIMIT 1
//     `;

//     const result = await client.query(q, [village_name]);

//     if (result.rows.length === 0) {
//       return res.json({
//         success: true,
//         message: "No NDVI alerts for this village"
//       });
//     }

//     const record = result.rows[0];

//     // ------------------------------------------------
//     // Notification Title
//     // ------------------------------------------------
//     let title = `NDVI Alert For ${monthFull}`;
//     let body = `Coupe: ${coupe_name}`;

//     switch (record.change_category) {

//       case "significant_decrease":
//         title = "🚨 Significant Vegetation Decrease";
//         body = `NDVI dropped from ${record.jan_ndvi} to ${record.feb_ndvi}`;
//         break;

//       case "moderate_decrease":
//         title = "⚠️ Moderate Vegetation Decrease";
//         body = `NDVI decreased from ${record.jan_ndvi} to ${record.feb_ndvi}`;
//         break;

//       case "significant_increase":
//         title = "🌱 Significant Vegetation Improvement";
//         body = `NDVI increased from ${record.jan_ndvi} to ${record.feb_ndvi}`;
//         break;

//       case "moderate_increase":
//         title = "📈 Moderate Vegetation Improvement";
//         body = `NDVI improved from ${record.jan_ndvi} to ${record.feb_ndvi}`;
//         break;
//     }

//     // ------------------------------------------------
//     // Send Firebase Notification
//     // ------------------------------------------------
//     const monthtext = "JANUARY";
//     const message = {
//       token: firebase_token,
//       notification: {
//         title,
//         body
//       },
//       data: {
//         id: String(record.id),
//         latitude: String(record.latitude || ""),
//         longitude: String(record.longitude || ""),
//         village_name,
//         coupe_name,
//         month: monthtext,
//       }
//     };
// console.log("📩 Sending notification with payload:", message);
//     const response = await admin.messaging().send(message);

//     // ------------------------------------------------
//     // Update notification flag
//     // ------------------------------------------------
//     await client.query(
//       `UPDATE public.${degraded_forest_Layer}
//        SET notification_sent = TRUE
//        WHERE pixle_id = $1`,
//       [record.id]
//     );

//   res.json({
//   success: true,
//   messageId: response,
//   data: record,
//   month: monthtext,
// });

//   } catch (err) {

//     console.error("Notification Error:", err);

//     res.status(500).json({
//       success: false,
//       error: err.message
//     });

//   }

// });

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

    if (!firebase_token || !user_id || !village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        received: { firebase_token: !!firebase_token, user_id: !!user_id, village_name: !!village_name, coupe_name: !!coupe_name },
        bodyKeys: Object.keys(req.body || {})
      });
    }

    // ------------------------------------------------
    // 1️⃣ Create table if not exists
    // ------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ndvi_notification_users (
        user_id TEXT PRIMARY KEY,
        firebase_token TEXT,
        village_name TEXT,
        coupe_name TEXT
      )
    `);

    // ------------------------------------------------
    // 2️⃣ Insert or update user subscription
    // ------------------------------------------------
    await client.query(
      `
      INSERT INTO public.ndvi_notification_users
      (user_id, firebase_token, village_name, coupe_name)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        firebase_token = EXCLUDED.firebase_token,
        village_name = EXCLUDED.village_name,
        coupe_name = EXCLUDED.coupe_name
      `,
      [user_id, firebase_token, village_name, coupe_name]
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
            title = `🚨 Significant Vegetation Decrease — ${prevMonthLabel}`;
            body = `NDVI dropped significantly in ${user.village_name}`;
            break;
          case 'moderate_decrease':
            title = `⚠️ Moderate Vegetation Decrease — ${prevMonthLabel}`;
            body = `NDVI decreased in ${user.village_name}`;
            break;
          case 'significant_increase':
            title = `🌱 Significant Vegetation Improvement — ${prevMonthLabel}`;
            body = `NDVI improved significantly in ${user.village_name}`;
            break;
          case 'moderate_increase':
            title = `📈 Moderate Vegetation Improvement — ${prevMonthLabel}`;
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
            INSERT INTO public.ndvi_notification_log (user_id, table_name, pixel_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [userId, tableName, pixelId]);

          result.sent++;
          result.details.push({ table: tableName, pixel_id: pixelId, category: record.change_category });
        } catch (sendErr) {
          console.error(`[pending-notifications] ❌ Firebase send error:`, sendErr.message);
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
        message: 'No firebase token available — user not subscribed or token cleared',
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

// Export the function so it can be called from forestLogin.js
router.sendPendingNotificationsFromPreviousMonth = sendPendingNotificationsFromPreviousMonth;

module.exports = router;

