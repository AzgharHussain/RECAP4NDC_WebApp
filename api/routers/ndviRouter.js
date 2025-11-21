const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/ndvidatabase');

// Define the API endpoint to fetch NDVI change data
router.post('/ndvi-change', async (req, res) => {
    const {tableName} = req.body
    try {
        const query = `
           SELECT *
	FROM public."${tableName}";
        `;

        // Execute the query using Sequelize
        const [results] = await sequelize.query(query);

        // Send the results as a JSON response
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching NDVI change data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch NDVI change data',
            error: error.message,
        });
    }
});

module.exports = router;
