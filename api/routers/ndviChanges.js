const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/database");
const { verifyJwt } = require("../middlewares/verifyJwt");

/**
 * NDVI Changes Router
 *
 * Provides APIs for:
 *  - GET  /api/ndvi-changes/user/:user_id  → list all NDVI changes for a user's village/coupe
 *  - GET  /api/ndvi-changes/point/:table_name/:pixel_id → single point details
 *  - PUT  /api/ndvi-changes/status → update status + note of a specific point
 *  - GET  /api/ndvi-changes/tables → list all NDVI Change tables
 */

// Whitelist valid characters for table names to prevent SQL injection
const isValidTableName = (name) => /^[a-zA-Z0-9_]+$/.test(name);

/**
 * GET /api/ndvi-changes/user/:user_id
 * Returns all NDVI changes for the user's subscribed village/coupe.
 * The user's village_name and coupe_name are looked up from ndvi_notification_users.
 */
router.get("/user/:user_id", verifyJwt, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { limit } = req.query;
    const rowLimit = Math.min(Math.max(parseInt(limit) || 500, 1), 5000);

    // Get user's subscription info
    const users = await sequelize.query(
      `SELECT user_id, village_name, coupe_name FROM public.ndvi_notification_users WHERE user_id = :user_id`,
      { replacements: { user_id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: "User subscription not found" });
    }

    const { village_name, coupe_name } = users[0];

    // Find all NDVI Change tables matching this coupe
    const tables = await sequelize.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name LIKE '%_NDVI_Change'
         AND UPPER(table_name) LIKE UPPER(:coupePattern)`,
      {
        replacements: { coupePattern: `%_${coupe_name}_NDVI_Change%` },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!tables.length) {
      return res.json({ success: true, data: [], village_name, coupe_name, total: 0 });
    }

    const allChanges = [];

    for (const { table_name } of tables) {
      if (!isValidTableName(table_name)) continue;

      // Check which columns exist on this table
      const cols = await sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = :tableName`,
        { replacements: { tableName: table_name }, type: sequelize.QueryTypes.SELECT }
      );
      const colSet = new Set(cols.map(c => c.column_name));

      const idCol = colSet.has('pixle_id') ? '"pixle_id"' : (colSet.has('id') ? '"id"' : null);
      if (!idCol) continue;

      const selectCols = [
        `${idCol}::text AS pixel_id`,
        colSet.has('NDVI_change') ? '"NDVI_change"' : 'NULL::float AS "NDVI_change"',
        colSet.has('change_category') ? '"change_category"' : 'NULL::text AS change_category',
        colSet.has('longitude') ? '"longitude"' : 'NULL::text AS longitude',
        colSet.has('latitude') ? '"latitude"' : 'NULL::text AS latitude',
        colSet.has('village') ? '"village"' : ':villageName AS village',
        colSet.has('note') ? '"note"' : 'NULL::text AS note',
        colSet.has('status') ? '"status"' : 'NULL::text AS status',
        colSet.has('division') ? '"division"' : 'NULL::text AS division',
        colSet.has('range') ? '"range"' : 'NULL::text AS "range"',
        colSet.has('round') ? '"round"' : 'NULL::text AS round',
        colSet.has('beat') ? '"beat"' : 'NULL::text AS beat',
      ].join(', ');

      try {
        const records = await sequelize.query(
          `SELECT ${selectCols}, :tableName AS table_name
           FROM public."${table_name}"
           WHERE ${colSet.has('village') ? '"village" = :villageName' : '1=1'}
           ORDER BY "NDVI_change" DESC
           LIMIT :limit`,
          {
            replacements: { villageName: village_name, tableName: table_name, limit: rowLimit },
            type: sequelize.QueryTypes.SELECT
          }
        );
        allChanges.push(...records);
      } catch (queryErr) {
        console.error(`[ndvi-changes] Query failed for "${table_name}":`, queryErr.message);
      }
    }

    res.json({
      success: true,
      data: allChanges,
      village_name,
      coupe_name,
      total: allChanges.length
    });
  } catch (err) {
    console.error("[ndvi-changes] Error fetching user changes:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ndvi-changes/point/:table_name/:pixel_id
 * Returns details of a single NDVI change point.
 */
router.get("/point/:table_name/:pixel_id", verifyJwt, async (req, res) => {
  try {
    const { table_name, pixel_id } = req.params;

    if (!isValidTableName(table_name)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }

    // Check which columns exist
    const cols = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :tableName`,
      { replacements: { tableName: table_name }, type: sequelize.QueryTypes.SELECT }
    );
    const colSet = new Set(cols.map(c => c.column_name));

    const idCol = colSet.has('pixle_id') ? '"pixle_id"' : (colSet.has('id') ? '"id"' : null);
    if (!idCol) {
      return res.status(400).json({ success: false, message: "No valid ID column found" });
    }

    const selectCols = [
      `${idCol}::text AS pixel_id`,
      colSet.has('NDVI_change') ? '"NDVI_change"' : 'NULL::float AS "NDVI_change"',
      colSet.has('change_category') ? '"change_category"' : 'NULL::text AS change_category',
      colSet.has('longitude') ? '"longitude"' : 'NULL::text AS longitude',
      colSet.has('latitude') ? '"latitude"' : 'NULL::text AS latitude',
      colSet.has('village') ? '"village"' : 'NULL::text AS village',
      colSet.has('note') ? '"note"' : 'NULL::text AS note',
      colSet.has('status') ? '"status"' : 'NULL::text AS status',
      colSet.has('division') ? '"division"' : 'NULL::text AS division',
      colSet.has('range') ? '"range"' : 'NULL::text AS "range"',
      colSet.has('round') ? '"round"' : 'NULL::text AS round',
      colSet.has('beat') ? '"beat"' : 'NULL::text AS beat',
      colSet.has('image_data') ? '"image_data"' : 'NULL::text AS image_data',
    ].join(', ');

    const records = await sequelize.query(
      `SELECT ${selectCols}
       FROM public."${table_name}"
       WHERE ${idCol}::text = :pixelId
       LIMIT 1`,
      { replacements: { pixelId: String(pixel_id) }, type: sequelize.QueryTypes.SELECT }
    );

    if (!records.length) {
      return res.status(404).json({ success: false, message: "Point not found" });
    }

    res.json({ success: true, data: records[0], table_name });
  } catch (err) {
    console.error("[ndvi-changes] Error fetching point:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/ndvi-changes/status
 * Updates the status and/or note of a specific NDVI change point.
 *
 * Body:
 *   table_name  — the NDVI Change table name
 *   pixel_id    — the pixel ID (pixle_id)
 *   status      — new status (e.g., "Pending", "Resolved", "Under Review")
 *   note        — optional note/action taken text
 */
router.put("/status", verifyJwt, async (req, res) => {
  try {
    const { table_name, pixel_id, status, note } = req.body;

    if (!table_name || !pixel_id) {
      return res.status(400).json({ success: false, message: "table_name and pixel_id are required" });
    }

    if (!isValidTableName(table_name)) {
      return res.status(400).json({ success: false, message: "Invalid table name" });
    }

    // Check which columns exist
    const cols = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :tableName`,
      { replacements: { tableName: table_name }, type: sequelize.QueryTypes.SELECT }
    );
    const colSet = new Set(cols.map(c => c.column_name));

    const idCol = colSet.has('pixle_id') ? '"pixle_id"' : (colSet.has('id') ? '"id"' : null);
    if (!idCol) {
      return res.status(400).json({ success: false, message: "No valid ID column found" });
    }

    // Build SET clause dynamically based on available columns
    const setClauses = [];
    const replacements = { pixelId: String(pixel_id) };

    if (status !== undefined) {
      if (colSet.has('status')) {
        setClauses.push('"status" = :status');
        replacements.status = status;
      } else {
        // Add the column if it doesn't exist
        await sequelize.query(`ALTER TABLE public."${table_name}" ADD COLUMN IF NOT EXISTS status TEXT`);
        setClauses.push('"status" = :status');
        replacements.status = status;
      }
    }

    if (note !== undefined) {
      if (colSet.has('note')) {
        setClauses.push('"note" = :note');
        replacements.note = note;
      } else {
        await sequelize.query(`ALTER TABLE public."${table_name}" ADD COLUMN IF NOT EXISTS note TEXT`);
        setClauses.push('"note" = :note');
        replacements.note = note;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update (provide status and/or note)" });
    }

    const result = await sequelize.query(
      `UPDATE public."${table_name}"
       SET ${setClauses.join(', ')}
       WHERE ${idCol}::text = :pixelId
       RETURNING ${idCol}::text AS pixel_id, ${colSet.has('status') ? '"status"' : 'NULL::text AS status'}, ${colSet.has('note') ? '"note"' : 'NULL::text AS note'}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    if (!result.length) {
      return res.status(404).json({ success: false, message: "Point not found" });
    }

    res.json({
      success: true,
      message: "Status updated successfully",
      data: result[0]
    });
  } catch (err) {
    console.error("[ndvi-changes] Error updating status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ndvi-changes/tables
 * Lists all NDVI Change table names.
 */
router.get("/tables", verifyJwt, async (req, res) => {
  try {
    const tables = await sequelize.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name LIKE '%_NDVI_Change'
       ORDER BY table_name`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({ success: true, data: tables.map(t => t.table_name) });
  } catch (err) {
    console.error("[ndvi-changes] Error listing tables:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
