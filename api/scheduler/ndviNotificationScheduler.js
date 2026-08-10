const cron = require("node-cron");
const { sequelize } = require("../config/r_quire");
const { ensurePixleIdColumn } = require("../utils/ensurePixleId");

module.exports = function startNdviScheduler(admin) {

  cron.schedule("*/1000 * * * *", async () => {


    try {

      const client = sequelize.getQueryInterface().sequelize;

      // ------------------------------------------------
      // 1️⃣ Get NDVI tables
      // ------------------------------------------------
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
        AND table_name LIKE '%_NDVI_Change'
      `, { type: sequelize.QueryTypes.SELECT });

      if (!tables.length) {
        return;
      }

      // ------------------------------------------------
      // 2️⃣ Get subscribed users
      // ------------------------------------------------
      const users = await client.query(`
        SELECT user_id, firebase_token, village_name, coupe_name
        FROM public.ndvi_notification_users
        WHERE firebase_token IS NOT NULL
      `, { type: sequelize.QueryTypes.SELECT });

      if (!users.length) {
        return;
      }

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
            records = await client.query(`
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

          // ------------------------------------------------
          // 5️⃣ Check if already notified
          // ------------------------------------------------
          const alreadySent = await client.query(`
            SELECT 1
            FROM public.ndvi_notification_log
            WHERE user_id = $1
            AND table_name = $2
            AND pixel_id = $3
            LIMIT 1
          `, {
            bind: [user_id, tableName, record.pixle_id],
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
              pixle_id: String(record.pixle_id),
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
            await client.query(`
              INSERT INTO public.ndvi_notification_log
              (user_id, table_name, pixel_id)
              VALUES ($1,$2,$3)
              ON CONFLICT DO NOTHING
            `, {
              bind: [user_id, tableName, record.pixle_id],
              type: sequelize.QueryTypes.INSERT
            });

          } catch (err) {

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

    } catch (err) {

      console.error("❌ Scheduler error:", err);

    }

  });

};