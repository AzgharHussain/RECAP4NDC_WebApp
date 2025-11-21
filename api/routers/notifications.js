const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const admin = require("firebase-admin");
const { DATE } = require('sequelize');

const router = express.Router();
const upload = multer();


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
  host: '68.178.167.39',
  user: 'postgres',
  password: 'P$DB@25%$#!09',
  port: 5432,
  database: 'Recap4NDC_new'
});

client.connect()
  .then(() => console.log("🟢 Database connected"))
  .catch(err => console.error("🔴 DB connection failed:", err));



// ----------------------------------------------------
// 3. NDVI Table Name
// ----------------------------------------------------
const degraded_forest_Layer = `"2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI_Change"`;

const degraded_forest_Layer_N=`2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI_Change`;
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
router.post("/send-notifications", upload.none(), async (req, res) => {
  try {
    const firebase_token = (req.body.firebase_token || "").trim();
    const user_id = (req.body.user_id || "").trim();

    if (!firebase_token || !user_id) {
      return res.status(400).json({
        success: false,
        error: "firebase_token and user_id required"
      });
    }

    // Fetch pending NDVI records
    const q = `
     SELECT "jan_NDVI", "feb_NDVI", "NDVI_change", change_category, geom, centroid, longitude, latitude, notification_sent, id

      FROM public.${degraded_forest_Layer}
      WHERE notification_sent = FALSE
      ORDER BY "NDVI_change" DESC
      LIMIT 1
    `;

    const result = await client.query(q);
    const records = result.rows;

    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending NDVI notifications"
      });
    }

    const successList = [];
    const failedList = [];

    for (const record of records) {
      const sendRes = await sendNotification(firebase_token, record);

      if (sendRes.success) {
        await setNotificationSent(record.id);
        successList.push({
          id: record.id,
          change_category: record.change_category
        });
      } else {
        failedList.push({
          id: record.id,
          error: sendRes.error
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: records.length,
        sent: successList.length,
        failed: failedList.length
      },
      successful: successList,
      failed: failedList
    });

  } catch (err) {
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



