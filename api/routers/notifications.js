const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const admin = require("firebase-admin");
const { DATE } = require('sequelize');

const router = express.Router();
const upload = multer();
const { verifyJwt } = require("../middlewares/verifyJwt"); 


// ----------------------------------------------------
// 1. Initialize Firebase Admin SDK
// ----------------------------------------------------
try {
  const serviceAccount = require("./recap4ndc-ad332-d882dbe98b5e.json");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Admin initialized");
  }
} catch (err) {
  console.error("❌ Firebase service account missing:", err);
}



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

client.connect()
  .then(() => console.log("🟢 Database connected"))
  .catch(err => console.error("🔴 DB connection failed:", err));



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
    const coupe_name = (req.body.coupe_name || "").trim();

    if (!firebase_token || !user_id || !village_name || !coupe_name) {
      return res.status(400).json({
        success: false,
        message: "firebase_token, user_id, village_name, coupe_name required"
      });
    }

    // ------------------------------------------------
    // Generate NDVI Table Name
    // ------------------------------------------------
    const degraded_forest_Layer = `"2026-01-01_${coupe_name}_NDVI_Change"`;

    // month extraction
    const date = "2026-01-01";
    const dateObj = new Date(date);
    const monthFull = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase();

    // ------------------------------------------------
    // Query NDVI record
    // ------------------------------------------------
    const q = `
      SELECT
        pixle_id as id,
        "Dec_NDVI" as jan_ndvi,
        "Jan_NDVI" as feb_ndvi,
        "NDVI_change" as ndvi_change,
        change_category,
        longitude,
        latitude
      FROM public.${degraded_forest_Layer}
      WHERE village = $1
      AND notification_sent = FALSE
      ORDER BY "NDVI_change" DESC
      LIMIT 1
    `;

    const result = await client.query(q, [village_name]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "No NDVI alerts for this village"
      });
    }

    const record = result.rows[0];

    // ------------------------------------------------
    // Notification Title
    // ------------------------------------------------
    let title = `NDVI Alert For ${monthFull}`;
    let body = `Coupe: ${coupe_name}`;

    switch (record.change_category) {

      case "significant_decrease":
        title = "🚨 Significant Vegetation Decrease";
        body = `NDVI dropped from ${record.jan_ndvi} to ${record.feb_ndvi}`;
        break;

      case "moderate_decrease":
        title = "⚠️ Moderate Vegetation Decrease";
        body = `NDVI decreased from ${record.jan_ndvi} to ${record.feb_ndvi}`;
        break;

      case "significant_increase":
        title = "🌱 Significant Vegetation Improvement";
        body = `NDVI increased from ${record.jan_ndvi} to ${record.feb_ndvi}`;
        break;

      case "moderate_increase":
        title = "📈 Moderate Vegetation Improvement";
        body = `NDVI improved from ${record.jan_ndvi} to ${record.feb_ndvi}`;
        break;
    }

    // ------------------------------------------------
    // Send Firebase Notification
    // ------------------------------------------------
    const message = {
      token: firebase_token,
      notification: {
        title,
        body
      },
      data: {
        id: String(record.id),
        latitude: String(record.latitude || ""),
        longitude: String(record.longitude || ""),
        village_name,
        coupe_name
      }
    };

    const response = await admin.messaging().send(message);

    // ------------------------------------------------
    // Update notification flag
    // ------------------------------------------------
    await client.query(
      `UPDATE public.${degraded_forest_Layer}
       SET notification_sent = TRUE
       WHERE pixle_id = $1`,
      [record.id]
    );

  res.json({
  success: true,
  messageId: response,
  data: record
});

  } catch (err) {

    console.error("Notification Error:", err);

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



module.exports = router;

