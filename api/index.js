const { Sequelize } = require('sequelize');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Initialize Sequelize with your database credentials
const sequelize = new Sequelize(
    'Recap4NDC', // Database name
    'postgres', // Username
    'DB@$ecure#25', // Password
    {
        host: 'localhost',
        dialect: 'postgres',
    }
);

// Function to connect to the database
const dbConnect = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Set up Multer for file uploads
const uploadDirectory = path.join(__dirname, '..', 'Incidentimage'); // __dirname refers to the current directory of server.js

// Ensure the upload directory exists
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
    console.log(`Created upload directory at: ${uploadDirectory}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        // Use the original file name
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Serve static image files
app.use('/Incidentimage', express.static(uploadDirectory));



// Test route
app.get('/', (req, res) => {
    res.send('Server is running and connected to the database!');
});

// GET API for incident categories
app.get('/api/incident-categories', async (req, res) => {
    try {
        const result = await sequelize.query("SELECT * FROM \"incident_category\"");
        res.json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving incident categories' });
    }
});

// New single POST API to insert data and save images
app.post('/api/full-incident', upload.array('images', 10), async (req, res) => {
    // Start a transaction to ensure atomicity
    const t = await sequelize.transaction();

    try {
        // req.body now contains the JSON fields, and req.files contains the uploaded files
        let patrol, incident, userId;
        
        try {
            patrol = JSON.parse(req.body.patrol);
            incident = JSON.parse(req.body.incident);
            userId = req.body.user_id; // Get the new user_id from the body
        } catch (parseError) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid JSON format for patrol or incident data.' });
        }

        // Get the list of file paths to save to the database
        // Fix: Use path.join and then replace backslashes with forward slashes for URLs
        const imageUrls = req.files.map(file => path.join('Incidentimage', file.originalname).replace(/\\/g, '/'));

        // 1. Validate required data (including the new user_id)
        if (!patrol || !incident || !userId) {
            await t.rollback();
            return res.status(400).json({ error: 'Missing required data: patrol, incident, or user_id.' });
        }

        // Validate patrol data
        if (!patrol.patrol_officer_name || !patrol.start_time || !patrol.path_coords || !Array.isArray(patrol.path_coords) || patrol.path_coords.length < 2) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid patrol data: missing officer name, start time, or a valid path_coords array.' });
        }

        // Validate incident data
        if (!incident.incident_category_id || !incident.incident_time || incident.latitude === undefined || incident.longitude === undefined) {
            await t.rollback();
            return res.status(400).json({ error: 'Invalid incident data: missing category ID, incident time, latitude, or longitude.' });
        }

        // Construct the LineString from the array of points for the patrol
        const pointStrings = patrol.path_coords.map(coord => `${coord.longitude} ${coord.latitude}`).join(', ');
        const lineString = `ST_GeomFromText('LINESTRING(${pointStrings})', 4326)`;

        // 2. Insert into patrols table with the user_id
        const patrolQuery = `
            INSERT INTO patrols (patrol_officer_name, start_time, end_time, start_location, end_location, distance_kms, cover_distance, user_id)
            VALUES (:patrol_officer_name, :start_time, :end_time, :start_location, :end_location, :distance_kms, ${lineString}, :user_id)
            RETURNING patrol_id;
        `;
        const [patrolResult] = await sequelize.query(patrolQuery, {
            replacements: { ...patrol, user_id: userId },
            type: sequelize.QueryTypes.INSERT,
            transaction: t
        });
        const patrolId = patrolResult[0].patrol_id;

        // 3. Insert into incidents table
        const incidentQuery = `
            INSERT INTO incidents (patrol_id, incident_category_id, incident_time, location_gps, incident_reported_by, incident_description, user_id)
            VALUES (:patrolId, :incident_category_id, :incident_time, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :incident_reported_by, :incident_description, :user_id)
            RETURNING incident_id;
        `;
        const [incidentResult] = await sequelize.query(incidentQuery, {
            replacements: { ...incident, patrolId, user_id: userId },
            type: sequelize.QueryTypes.INSERT,
            transaction: t
        });
        const incidentId = incidentResult[0].incident_id;

        // 4. Insert into incident_images table (bulk insert)
        if (imageUrls.length > 0) {
            const values = imageUrls.map(url => `(${incidentId}, '${url.replace(/'/g, "''")}')`).join(', ');
            const imagesQuery = `
                INSERT INTO incident_images (incident_id, image_url)
                VALUES ${values}
                RETURNING *;
            `;
            await sequelize.query(imagesQuery, { transaction: t });
        }

        // If all queries were successful, commit the transaction
        await t.commit();
        res.status(201).json({
            message: 'All data inserted successfully',
            patrol_id: patrolId,
            incident_id: incidentId
        });
    } catch (error) {
        // If any query fails, roll back the transaction
        await t.rollback();
        console.error('Transaction failed:', error);
        res.status(500).json({ error: 'Failed to create a full incident entry.' });
    }
});

// New GET API to retrieve all incidents with full image paths and category names according to user_id
app.get('/api/incidents-with-images', async (req, res) => {
    try {
        const { user_id } = req.query; // Get user_id from query parameters
        
        // Validate that user_id is provided
        if (!user_id) {
            return res.status(400).json({ error: 'Missing required query parameter: user_id' });
        }

        const query = `
            SELECT 
                i.*, 
                ic.category_name,
                JSON_AGG(T.image_url) AS image_urls
            FROM 
                incidents i
            LEFT JOIN 
                (
                    SELECT incident_id, CONCAT('http://localhost:5000/', image_url) as image_url
                    FROM incident_images
                ) AS T ON i.incident_id = T.incident_id
            LEFT JOIN 
                incident_category ic ON i.incident_category_id = ic.category_id
            WHERE 
                i.user_id = :user_id 
            GROUP BY 
                i.incident_id, ic.category_name;
        `;
        
        const [results] = await sequelize.query(query, {
            replacements: { user_id },
        });

        // Fix JSON_AGG returning a single null value if no images exist
        const processedResults = results.map(row => ({
            ...row,
            image_urls: row.image_urls.length === 1 && row.image_urls[0] === null ? [] : row.image_urls
        }));

        res.json(processedResults);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving incidents with images' });
    }
});

// New GET API to retrieve patrol data by user_id
app.get('/api/patrols-by-user', async (req, res) => {
    try {
        const { user_id } = req.query; // Get user_id from query parameters
        
        // Validate that user_id is provided
        if (!user_id) {
            return res.status(400).json({ error: 'Missing required query parameter: user_id' });
        }

        const query = `
            SELECT 
                patrol_id,
                patrol_officer_name,
                start_time,
                end_time,
                start_location,
                end_location,
                distance_kms,
                user_id
            FROM patrols
            WHERE user_id = :user_id;
        `;
        
        const [results] = await sequelize.query(query, {
            replacements: { user_id },
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving patrols' });
    }
});




// Start server and connect to DB
const PORT = 5000;
app.listen(PORT, async () => {
    await dbConnect();
    console.log(`Server is running on port ${PORT}`);
});
