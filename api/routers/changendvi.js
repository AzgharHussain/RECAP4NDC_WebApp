const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/ndvidatabase");

/**
 * ===============================
 * 1️⃣ CREATE TABLE IF NOT EXISTS
 * ===============================
 */
router.get("/init-table", async (req, res) => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ndvi_change (
        id SERIAL PRIMARY KEY,
        state VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_month_ndvi FLOAT NOT NULL,
        end_month_ndvi FLOAT NOT NULL,
        ndvi_change FLOAT NOT NULL,
        change_layer_name VARCHAR(200) NOT NULL,
        coupe_name VARCHAR(200),
        longitude DOUBLE PRECISION NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sequelize.query(createTableQuery);

    res.status(200).json({
      message: "NDVI Change table created or already exists",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * 2️⃣ INSERT NDVI RECORD
 * ===============================
 */
router.post("/create_changendvi", async (req, res) => {
  try {
    const {
      state,
      start_date,
      end_date,
      start_month_ndvi,
      end_month_ndvi,
      change_layer_name,
      coupe_name,
      longitude,
      latitude,
    } = req.body;

    const ndvi_change = end_month_ndvi - start_month_ndvi;

    const insertQuery = `
      INSERT INTO ndvi_change
      (state, start_date, end_date, start_month_ndvi, end_month_ndvi, ndvi_change,
       change_layer_name, coupe_name, longitude, latitude)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *;
    `;

    const [result] = await sequelize.query(insertQuery, {
      replacements: [
        state,
        start_date,
        end_date,
        start_month_ndvi,
        end_month_ndvi,
        ndvi_change,
        change_layer_name,
        coupe_name,
        longitude,
        latitude,
      ],
    });

    res.status(201).json({
      message: "NDVI record created successfully",
      data: result[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * 3️⃣ GET ALL RECORDS
 * ===============================
 */
router.get("/changendvi", async (req, res) => {
  try {
    const [data] = await sequelize.query(
      "SELECT * FROM ndvi_change ORDER BY created_at DESC"
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * 4️⃣ GET RECORD BY ID
 * ===============================
 */
router.get("/changendvi/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [data] = await sequelize.query(
      "SELECT * FROM ndvi_change WHERE id = ?",
      { replacements: [id] }
    );

    if (!data.length) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * 5️⃣ UPDATE RECORD
 * ===============================
 */
router.put("/update_changendvi/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      state,
      start_date,
      end_date,
      start_month_ndvi,
      end_month_ndvi,
      change_layer_name,
      coupe_name,
      longitude,
      latitude,
    } = req.body;

    const ndvi_change = end_month_ndvi - start_month_ndvi;

    const updateQuery = `
      UPDATE ndvi_change
      SET
        state = ?,
        start_date = ?,
        end_date = ?,
        start_month_ndvi = ?,
        end_month_ndvi = ?,
        ndvi_change = ?,
        change_layer_name = ?,
        coupe_name = ?,
        longitude = ?,
        latitude = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *;
    `;

    const [result] = await sequelize.query(updateQuery, {
      replacements: [
        state,
        start_date,
        end_date,
        start_month_ndvi,
        end_month_ndvi,
        ndvi_change,
        change_layer_name,
        coupe_name,
        longitude,
        latitude,
        id,
      ],
    });

    if (!result.length) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({
      message: "Record updated successfully",
      data: result[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * 6️⃣ DELETE RECORD
 * ===============================
 */
router.delete("/delete_changendvi/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await sequelize.query(
      "DELETE FROM ndvi_change WHERE id = ? RETURNING *;",
      { replacements: [id] }
    );

    if (!result.length) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({
      message: "Record deleted successfully",
      data: result[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
