const { Sequelize } = require('sequelize');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Initialize Sequelize with your database credentials
const sequelize = new Sequelize(
    'GIZ', // Database name
    'postgres', // Username
    'pass@123', // Password
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
// New single POST API to insert data and save images
app.post('/api/full-incident', upload.array('images', 10), async (req, res) => {
    try {
        // Check if patrol and incidents data exist
        if (!req.body.patrol || !req.body.incidents) {
            return res.status(400).json({ error: 'Missing patrol or incidents data in request body.' });
        }

        const patrolData = JSON.parse(req.body.patrol);
        const incidentsData = JSON.parse(req.body.incidents); // <<< Use this directly
        const userId = req.body.user_id;

        // Clean the latlong string
        if (patrolData.latlong) {
            patrolData.latlong = patrolData.latlong.trim().replace(/,+$/, '');
        }

        // Convert date fields to ISO 8601 strings for PostgreSQL
        if (patrolData.start_time) {
            patrolData.start_time = new Date(patrolData.start_time).toISOString();
        }
        if (patrolData.end_time) {
            patrolData.end_time = new Date(patrolData.end_time).toISOString();
        }

        incidentsData.forEach(incident => {
            if (incident.incident_time) {
                incident.incident_time = new Date(incident.incident_time).toISOString();
            }
        });

        // Define the SQL query to call the function
        const query = `
            SELECT * FROM create_full_incident(
                :patrol_data,
                :incidents_data,
                :user_id
            );
        `;

        // Execute the query using Sequelize
        const result = await sequelize.query(query, {
            replacements: {
                patrol_data: JSON.stringify(patrolData),
                incidents_data: JSON.stringify(incidentsData), // <<< Send incidentsData directly
                user_id: userId,
            },
            type: sequelize.QueryTypes.SELECT
        });

        if (result && result.length > 0) {
            res.status(201).json({
                message: 'All data inserted successfully',
                patrol_id: result[0].patrol_id,
                incident_ids: result[0].incident_ids
            });
        } else {
            res.status(400).json({ error: 'Failed to insert incident data. No result returned.' });
        }

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
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'Missing required query parameter: user_id' });
        }

        // Corrected line: Do not use array destructuring
        const results = await sequelize.query('SELECT * FROM get_patrols_by_user(:user_id)', {
            replacements: { user_id },
            type: Sequelize.QueryTypes.SELECT,
        });

        // The 'results' variable now holds the entire array of patrol objects
        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error retrieving patrols' });
    }
});



// Define the API endpoint to call the PostgreSQL function
app.get('/api/coupe_metadata/location', async (req, res) => {
    try {
        // Corrected: Use sequelize.query to call the function
        const [result] = await sequelize.query('SELECT * FROM get_coupe_locations();');
        
        // Send the function's result as a JSON response
        res.status(200).json(result);
    } catch (err) {
        console.error('Error fetching coupe metadata:', err);
        // Respond with an error message
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Main API endpoint for creating a coupe log and uploading images
app.post('/api/coupe/log', upload.array('images', 10), async (req, res) => {
    // Destructure required fields and the single JSON string
    const { 
        issue_id, 
        issue_type, 
        observation_notes, 
        user_id,
        input_table_name, // ⭐ CHANGED: Replaced coupe_id with input_table_name
        officer_name,
        
        // Capture the single JSON string from the form-data body
        properties_data
    } = req.body;
    
    const propertiesJsonString = properties_data; 

    // Assuming imagePathsArray is generated correctly from req.files
    const imagePathsArray = req.files.map(file => file.filename);

    // Manually construct the PostgreSQL array literal string
    const imagePathsLiteral = `ARRAY[${imagePathsArray.map(path => `'${path}'`).join(', ')}]`;

    try {
        // 2. The function call query, rebuilt to ensure clean spacing
        const functionCallQuery = `
            SELECT public.insert_coupe_log_with_images(
                :issue_id, 
                :issue_type, 
                :observation_notes, 
                :user_id, 
                :input_table_name, -- ⭐ CHANGED: Replaced :coupe_id with :input_table_name
                :officer_name, 
                CAST(:properties_json AS jsonb), 
                ${imagePathsLiteral}
            ) AS log_id;
        `;
        
        // 3. Execute the query
        const [functionResult] = await sequelize.query(functionCallQuery, {
            replacements: {
                issue_id: issue_id,
                issue_type: issue_type,
                observation_notes: observation_notes,
                user_id: user_id,
                input_table_name: input_table_name, // ⭐ CHANGED: Pass the new value
                officer_name: officer_name,
                // Pass the raw string for the JSON column
                properties_json: propertiesJsonString
            },
            type: Sequelize.QueryTypes.SELECT 
        });
        
        const logId = functionResult.log_id;
        if (logId) {
            res.status(201).json({ message: 'Coupe log created successfully', logId });
        } else {
            res.status(500).json({ error: 'Failed to retrieve log_id from database function.' });
        }

    } catch (error) {
        console.error('Error in API endpoint:', error);
        res.status(500).json({ error: 'Failed to create coupe log.', details: error.message });
    }
});



app.get('/api/coupe/log-with-images', async (req, res) => {
    try {
        const { user_id } = req.query; // Get user_id from query parameters
        
        // Validate that user_id is provided
        if (!user_id) {
            return res.status(400).json({ error: 'Missing required query parameter: user_id' });
        }

        // Call the PostgreSQL function and pass the user ID as a parameter
        const query = 'SELECT * FROM get_coupe_logs_with_details(:user_id);';
        
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

// Start server and connect to DB
const PORT = 5000;
app.listen(PORT, async () => {
    await dbConnect();
    console.log(`Server is running on port ${PORT}`);
});
