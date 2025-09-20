const { Sequelize } = require('sequelize');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Initialize Sequelize with your database credentials
const sequelize = new Sequelize(
    'Giz', // Database name
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
app.post('/api/full-incident', upload.array('images', 10), async (req, res) => {
    try {
        // Parse and validate data from the request body
        const patrolData = JSON.parse(req.body.patrol); // Patrol data
        const incidentData = JSON.parse(req.body.incident); // Incident data
        const userId = req.body.user_id; // User ID

        // Prepare the image URLs
        const imageUrls = req.files.map(file => path.join('Incidentimage', file.originalname).replace(/\\/g, '/'));

        // *** FIX: Format the imageUrls array for PostgreSQL ***
        const pgArrayLiteral = imageUrls.length > 0 
            ? `{${imageUrls.map(url => `"${url.replace(/"/g, '""')}"`).join(',')}}`
            : `{}`;

        // Convert date fields to ISO 8601 strings
        patrolData.start_time = new Date(patrolData.start_time).toISOString();  // Convert to ISO string
        patrolData.end_time = new Date(patrolData.end_time).toISOString();      // Convert to ISO string
        incidentData.incident_time = new Date(incidentData.incident_time).toISOString(); // Convert to ISO string

        // Define the SQL query to call the function
        const query = `
            SELECT * FROM create_full_incident(
                :patrol_data, 
                :incident_data, 
                :user_id, 
                :image_urls
            );
        `;

        // Execute the query using Sequelize
        const result = await sequelize.query(query, {
            replacements: {
                patrol_data: JSON.stringify(patrolData),
                incident_data: JSON.stringify(incidentData),
                user_id: userId,
                image_urls: pgArrayLiteral
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Check if the result is empty or malformed
        if (result && result.length > 0) {
            // Send a success response with the IDs returned from the function
            res.status(201).json({
                message: 'All data inserted successfully via function',
                patrol_id: result[0].patrol_id, // Access the first element of the array
                incident_id: result[0].incident_id
            });
        } else {
            // Handle the case when result is empty
            res.status(400).json({ error: 'Failed to insert incident data. No result returned.' });
        }

    } catch (error) {
        // Handle errors
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



// Start server and connect to DB
const PORT = 5000;
app.listen(PORT, async () => {
    await dbConnect();
    console.log(`Server is running on port ${PORT}`);
});
