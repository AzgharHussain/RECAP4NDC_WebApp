const express = require('express');
const router = express.Router();
const {sequelize }= require('../config/database');

// ================================
// CREATE TABLE IF NOT EXISTS
// ================================
const initTable = async () => {
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS user_locations (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✔ user_locations table ready!");
    } catch (err) {
        console.error("❌ Error creating user_locations table:", err);
    }
};

initTable(); // Auto-run table creation

// ================================
// GET ALL USER LOCATIONS
// ================================
router.get('/user-locations', async (req, res) => {
    try {
        const [results] = await sequelize.query(`SELECT * FROM user_locations ORDER BY user_id DESC;`);
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("Error fetching user locations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user locations",
            error: error.message,
        });
    }
});

// ================================
// INSERT NEW USER LOCATION
// ================================
router.post('/user-locations', async (req, res) => {
    try {
        const { username, latitude, longitude } = req.body;

        if (!username || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "username, latitude, longitude are required",
            });
        }

        const insertQuery = `
            INSERT INTO user_locations (username, latitude, longitude)
            VALUES (:username, :latitude, :longitude)
            RETURNING *;
        `;

        const [result] = await sequelize.query(insertQuery, {
            replacements: { username, latitude, longitude }
        });

        res.json({
            success: true,
            message: "Location added successfully",
            data: result[0]
        });

    } catch (error) {
        console.error("Error inserting user location:", error);
        res.status(500).json({
            success: false,
            message: "Failed to insert user location",
            error: error.message,
        });
    }
});

// ================================
// UPDATE USER LOCATION
// ================================
router.put('/user-locations/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { username, latitude, longitude } = req.body;

        const updateQuery = `
            UPDATE user_locations
            SET 
                username = COALESCE(:username, username),
                latitude = COALESCE(:latitude, latitude),
                longitude = COALESCE(:longitude, longitude),
                timestamp = CURRENT_TIMESTAMP
            WHERE user_id = :user_id
            RETURNING *;
        `;

        const [result] = await sequelize.query(updateQuery, {
            replacements: { user_id, username, latitude, longitude }
        });

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User location not found"
            });
        }

        res.json({
            success: true,
            message: "Location updated successfully",
            data: result[0]
        });

    } catch (error) {
        console.error("Error updating user location:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update user location",
            error: error.message,
        });
    }
});

module.exports = router;
