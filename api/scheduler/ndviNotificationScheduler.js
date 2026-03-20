const cron = require("node-cron");
const { sequelize } = require("../config/r_quire");

module.exports = function startNdviScheduler(admin) {

  cron.schedule("*/10 * * * *", async () => {

    console.log("🌿 Running NDVI notification scheduler...");

    // try {

    //   const client = sequelize.getQueryInterface().sequelize;

    //   // ------------------------------------------------
    //   // 1️⃣ Get NDVI tables
    //   // ------------------------------------------------
    //   const tables = await client.query(`
    //     SELECT table_name
    //     FROM information_schema.tables
    //     WHERE table_schema='public'
    //     AND table_name LIKE '%_NDVI_Change'
    //   `, { type: sequelize.QueryTypes.SELECT });

    //   if (!tables.length) {
    //     console.log("📭 No NDVI tables found");
    //     return;
    //   }

    //   // ------------------------------------------------
    //   // 2️⃣ Get subscribed users
    //   // ------------------------------------------------
    //   const users = await client.query(`
    //     SELECT user_id, firebase_token, village_name, coupe_name
    //     FROM public.ndvi_notification_users
    //     WHERE firebase_token IS NOT NULL
    //   `, { type: sequelize.QueryTypes.SELECT });

    //   if (!users.length) {
    //     console.log("👥 No subscribed users");
    //     return;
    //   }

    //   // ------------------------------------------------
    //   // 3️⃣ Loop NDVI tables
    //   // ------------------------------------------------
    //   for (const table of tables) {

    //     const tableName = table.table_name;

    //     console.log("🔎 Checking table:", tableName);

    //     for (const user of users) {

    //       const { user_id, firebase_token, village_name, coupe_name } = user;

    //       // Match coupe
    //       if (!tableName.toUpperCase().includes(`_${coupe_name.toUpperCase()}_NDVI_CHANGE`)) {
    //         continue;
    //       }

    //       // ------------------------------------------------
    //       // 4️⃣ Get NDVI change record
    //       // ------------------------------------------------
    //       const records = await client.query(`
    //         SELECT
    //           pixle_id,
    //           "NDVI_change",
    //           change_category,
    //           longitude,
    //           latitude
    //         FROM public."${tableName}"
    //         WHERE village = $1
    //         ORDER BY "NDVI_change" DESC
    //         LIMIT 1
    //       `, {
    //         bind: [village_name],
    //         type: sequelize.QueryTypes.SELECT
    //       });

    //       if (!records.length) continue;

    //       const record = records[0];

    //       // ------------------------------------------------
    //       // 5️⃣ Check if already notified
    //       // ------------------------------------------------
    //       const alreadySent = await client.query(`
    //         SELECT 1
    //         FROM public.ndvi_notification_log
    //         WHERE user_id = $1
    //         AND table_name = $2
    //         AND pixel_id = $3
    //         LIMIT 1
    //       `, {
    //         bind: [user_id, tableName, record.pixle_id],
    //         type: sequelize.QueryTypes.SELECT
    //       });

    //       if (alreadySent.length) {
    //         console.log(`⏭️ Notification already sent to user ${user_id}`);
    //         continue;
    //       }

    //       // ------------------------------------------------
    //       // 6️⃣ Prepare Firebase message
    //       // ------------------------------------------------
    //       const message = {
    //         token: firebase_token,
    //         notification: {
    //           title: "NDVI Alert 🌿",
    //           body: `Vegetation change detected in ${village_name}`
    //         },
    //         data: {
    //           pixle_id: String(record.pixle_id),
    //           village_name,
    //           coupe_name,
    //           latitude: String(record.latitude || ""),
    //           longitude: String(record.longitude || ""),
    //           ndvi_change: String(record.NDVI_change || ""),
    //           change_category: String(record.change_category || ""),
    //           table_name: tableName
    //         }
    //       };

    //       try {

    //         // ------------------------------------------------
    //         // 7️⃣ Send Firebase notification
    //         // ------------------------------------------------
    //         await admin.messaging().send(message);

    //         console.log(`📩 Notification sent to user ${user_id}`);

    //         // ------------------------------------------------
    //         // 8️⃣ Insert log record
    //         // ------------------------------------------------
    //         await client.query(`
    //           INSERT INTO public.ndvi_notification_log
    //           (user_id, table_name, pixel_id)
    //           VALUES ($1,$2,$3)
    //           ON CONFLICT DO NOTHING
    //         `, {
    //           bind: [user_id, tableName, record.pixle_id],
    //           type: sequelize.QueryTypes.INSERT
    //         });

    //       } catch (err) {

    //         console.error("❌ Firebase send error:", err.message);

    //       }

    //     }

    //   }

    // } catch (err) {

    //   console.error("❌ Scheduler error:", err);

    // }

  });

};