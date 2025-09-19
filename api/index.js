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
// New GET API for incident categories using a PostgreSQL function
app.get('/api/incident-categories', async (req, res) => {
    try {
        const query = 'SELECT * FROM get_all_incident_categories()';
        const [result] = await sequelize.query(query);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving incident categories' });
    }
});

// New single POST API to insert data and save images
// New single POST API to insert data and save images using a PostgreSQL function
app.post('/api/full-incident', upload.array('images', 10), async (req, res) => {
    // Note: The transaction is now handled inside the PostgreSQL function,
    // so we don't need a separate Sequelize transaction here.

    try {
        let patrol, incident, userId;

        try {
            patrol = JSON.parse(req.body.patrol);
            incident = JSON.parse(req.body.incident);
            userId = req.body.user_id; // Get the new user_id from the body
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid JSON format for patrol or incident data.' });
        }

        // Get the list of file paths to save to the database
        const imageUrls = req.files.map(file => path.join('Incidentimage', file.originalname).replace(/\\/g, '/'));

        // Validate required data (including the new user_id)
        if (!patrol || !incident || !userId) {
            return res.status(400).json({ error: 'Missing required data: patrol, incident, or user_id.' });
        }

        // Validate patrol data
        if (!patrol.patrol_officer_name || !patrol.start_time || !patrol.path_coords || !Array.isArray(patrol.path_coords) || patrol.path_coords.length < 2) {
            return res.status(400).json({ error: 'Invalid patrol data: missing officer name, start time, or a valid path_coords array.' });
        }

        // Validate incident data
        if (!incident.incident_category_id || !incident.incident_time || incident.latitude === undefined || incident.longitude === undefined) {
            return res.status(400).json({ error: 'Invalid incident data: missing category ID, incident time, latitude, or longitude.' });
        }

        // Prepare the path coordinates string for the function call
        const pointStrings = patrol.path_coords.map(coord => `${coord.longitude} ${coord.latitude}`).join(', ');

        // Call the PostgreSQL function
        const query = `SELECT * FROM insert_full_incident(
            :patrol_officer_name,
            :start_time,
            :end_time,
            :start_location,
            :end_location,
            :distance_kms,
            :pointStrings,
            :user_id,
            :incident_category_id,
            :incident_time,
            :incident_latitude,
            :incident_longitude,
            :incident_reported_by,
            :incident_description,
            :image_urls
        )`;

        const [result] = await sequelize.query(query, {
            replacements: {
                ...patrol,
                ...incident,
                pointStrings: pointStrings,
                user_id: userId,
                image_urls: imageUrls,
                incident_latitude: incident.latitude,
                incident_longitude: incident.longitude
            }
        });

        // The result from the function is an array containing an object with patrol_id and incident_id
        const { patrol_id, incident_id } = result[0];

        res.status(201).json({
            message: 'All data inserted successfully',
            patrol_id: patrol_id,
            incident_id: incident_id
        });
    } catch (error) {
        console.error('API call failed:', error);
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

        // Call the PostgreSQL function and pass the user ID as a parameter
        const query = 'SELECT * FROM get_incidents_with_details(:user_id);';
        
        const [results] = await sequelize.query(query, {
            replacements: { user_id },
        });

        // The PostgreSQL function's JSONB_AGG will return a single [null] if no images exist.
        // This processes the results to return an empty array instead.
        const processedResults = results.map(row => ({
            ...row,
            image_urls: row.image_urls && row.image_urls[0] === null ? [] : row.image_urls
        }));

        res.json(processedResults);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving incidents with images' });
    }
});

// New GET API to retrieve incident data by user_id using a PostgreSQL function
app.get('/api/patrols-by-user', async (req, res) => {
    try {
        const { user_id } = req.query; // Get user_id from query parameters

        // Validate that user_id is provided
        if (!user_id) {
            return res.status(400).json({ error: 'Missing required query parameter: user_id' });
        }

        // The query now executes the PostgreSQL function with the user_id as a parameter.
        // We use an array for the replacements when calling a function with positional parameters.
        const [results] = await sequelize.query('SELECT * FROM get_patrols_by_user(:user_id)', {
            replacements: { user_id },
            // Access QueryTypes directly from the Sequelize object
            type: Sequelize.QueryTypes.SELECT,
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
