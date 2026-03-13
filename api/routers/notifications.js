const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const admin = require("firebase-admin");
const { DATE } = require('sequelize');
const { sequelize } = require('../config/r_quire');
const router = express.Router();
const upload = multer();
const { verifyJwt } = require("../middlewares/verifyJwt"); 
const blacklistedTokens = require("../middlewares/tokenBlacklist");


// ----------------------------------------------------
// 2. Postgres Connection
// ----------------------------------------------------
const client = new Client({
  host: '68.178.167.216',
  user: 'postgres',
  password: 'pass@123',
  port: 5435,
  database: 'Recap4NDC_Query'
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
        pixel_id INTEGER,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, table_name, pixel_id)
      )
    `);

    console.log("✅ Notification tables ready");

  } catch (err) {

    console.error("❌ Error creating notification tables:", err);

  }

}

// run once
createNotificationTables();
client.connect()
  .then(() => console.log("🟢 Database connected"))
  .catch(err => console.error("🔴 DB connection failed:", err));

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
    const coupe_name = (req.body.coupe_name || "").trim();

    if (!firebase_token || !user_id || !village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
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

    res.json({
      success: true,
      message: "Notification subscription saved successfully"
    });

  } catch (err) {

    console.error("Subscription error:", err);

    res.status(500).json({
      success: false,
      error: err.message
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

    res.json({
      success: true,
      message: "Notification user updated successfully",
      data: result.rows[0]
    });

  } catch (err) {

    console.error("Update error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});


// ----------------------------------------------------
// 7. Test FCM with simple message
// ----------------------------------------------------
router.post("/test-fcm", upload.none(), async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(400).json({ message: "Token required" });
    }

    const token = authHeader.split(' ')[1];

    // get userId from request body or decoded token
    const { user_id } = req.body;

    const query = `
      DELETE FROM ndvi_notification_users
      WHERE user_id = $1
      RETURNING *;
    `;

    const values = [user_id];

    const result = await client.query(query, values);

    console.log("Adding to blacklist:", token);

    // Add token to blacklist
    blacklistedTokens.add(token);

    return res.json({
      message: "Logged out successfully",
      deletedUser: result.rows[0] || null
    });

  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;

