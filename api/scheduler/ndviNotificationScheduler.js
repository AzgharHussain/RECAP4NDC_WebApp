const cron = require("node-cron");
const { sequelize } = require('../config/r_quire');

module.exports = function startNdviScheduler( admin) {
  // store completed tables
  const completedTables = new Set();

  cron.schedule("*/3 * * * *", async () => {
    console.log("🌿 Running NDVI notification check...");

    try {
      // Get the database client from sequelize
      const client = sequelize.getQueryInterface().sequelize;

      // 1️⃣ Get NDVI tables
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
        AND table_name LIKE '%_NDVI_Change'
      `, { type: sequelize.QueryTypes.SELECT });

      // ✅ Check if tables exist
      if (!tables || tables.length === 0) {
        console.log("📭 No NDVI tables found to process");
        return;
      }

      console.log(`📊 Found ${tables.length} NDVI tables to check`);

      for (const table of tables) {
        // Handle different response formats
        const tableName = typeof table === 'object' ? table.table_name : table;

        if (!tableName) {
          console.log("⚠️ Skipping invalid table:", table);
          continue;
        }

        // Skip completed tables
        if (completedTables.has(tableName)) {
          console.log(`⏭️ Skipping completed table: ${tableName}`);
          continue;
        }

        console.log("🔎 Checking table:", tableName);

        // 2️⃣ Get subscribed users
        const users = await client.query(`
          SELECT user_id, firebase_token, village_name, coupe_name
          FROM public.ndvi_notification_users
          WHERE firebase_token IS NOT NULL
        `, { type: sequelize.QueryTypes.SELECT });

        if (!users || users.length === 0) {
          console.log("👥 No subscribed users found");
          continue;
        }

        for (const user of users) {
          // Validate user data
          if (!user.firebase_token || !user.village_name || !user.coupe_name) {
            console.log("⚠️ Skipping invalid user record:", user);
            continue;
          }

          const { firebase_token, village_name, coupe_name } = user;

          // Match coupe - with better matching logic
          const tableNameUpper = tableName.toUpperCase();
          const coupeNameUpper = coupe_name.toUpperCase();
          
          if (!tableNameUpper.includes(`_${coupeNameUpper}_NDVI_CHANGE`)) {
            continue;
          }

          try {
            // 3️⃣ Find NDVI change
            const ndviRecords = await client.query(`
              SELECT
                pixle_id,
                "NDVI_change",
                change_category,
                longitude,
                latitude
              FROM public."${tableName}"
              WHERE village = $1
              AND notification_sent = FALSE
              ORDER BY "NDVI_change" DESC
              LIMIT 1
            `, {
              bind: [village_name],
              type: sequelize.QueryTypes.SELECT
            });

            if (!ndviRecords || ndviRecords.length === 0) {
              console.log(`ℹ️ No pending NDVI changes for ${village_name} in ${tableName}`);
              continue;
            }

            const record = ndviRecords[0];

            // Validate record has required fields
            if (!record || !record.pixle_id) {
              console.log("⚠️ Invalid NDVI record:", record);
              continue;
            }

            const message = {
              token: firebase_token,
              notification: {
                title: "NDVI Alert 🌿",
                body: `Vegetation change detected in ${village_name}`
              },
              data: {
                pixle_id: String(record.pixle_id),
                village_name,
                coupe_name,
                latitude: String(record.latitude || ""),
                longitude: String(record.longitude || ""),
                ndvi_change: String(record.NDVI_change || ""),
                change_category: String(record.change_category || "")
              }
            };

            console.log(`📩 Sending notification to user in ${village_name}`);

            try {
              await admin.messaging().send(message);
              
              await client.query(`
                UPDATE public."${tableName}"
                SET notification_sent = TRUE
                WHERE pixle_id = $1
              `, {
                bind: [record.pixle_id],
                type: sequelize.QueryTypes.UPDATE
              });

              console.log(`✅ Notification sent for ${village_name} from ${tableName}`);
            } catch (notifError) {
              console.error(`❌ Failed to send notification for ${village_name}:`, notifError);
            }

          } catch (queryError) {
            console.error(`❌ Error querying table ${tableName} for village ${village_name}:`, queryError);
          }
        }

        // 4️⃣ Check if table still has pending notifications
        try {
          const pending = await client.query(`
            SELECT 1
            FROM public."${tableName}"
            WHERE notification_sent = FALSE
            LIMIT 1
          `, { type: sequelize.QueryTypes.SELECT });

          if (!pending || pending.length === 0) {
            completedTables.add(tableName);
            console.log(`✅ Table completed: ${tableName}`);
          }
        } catch (pendingError) {
          console.error(`❌ Error checking pending notifications for ${tableName}:`, pendingError);
        }
      }

    } catch (err) {
      console.error("❌ Scheduler error:", err);
    }
  });
};