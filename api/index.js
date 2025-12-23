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
    if (file.fieldname.startsWith('patrol_images')) {
      cb(null, patrolImageDir);
    } else if (file.fieldname.startsWith('incident_')) {
      cb(null, incidentImageDir);
    } else {
      cb(null, incidentImageDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Serve static image files
app.use('/Incidentimage', express.static(uploadDirectory));



// Test route
app.get('/', (req, res) => {
  res.send('Server is running and connected to PostgreSQL 🚀');
});

// ===========================================================
// 🔹 API: Get all incident categories
// ===========================================================
app.get('/api/incident-categories', async (req, res) => {
  try {
    const [result] = await sequelize.query('SELECT * FROM get_all_incident_categories()');
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error retrieving incident categories' });
  }
});

// ===========================================================
// 🔹 API: Create Patrol + Incidents + Upload Images
// ===========================================================
app.post('/api/full-incident', upload.any(), async (req, res) => {
  try {
    if (!req.body.patrol || !req.body.incidents || !req.body.user_id) {
      return res.status(400).json({ error: 'Missing patrol, incidents, or user_id in request body.' });
    }

    const patrolData = JSON.parse(req.body.patrol);
    const incidentsData = JSON.parse(req.body.incidents);
    const userId = req.body.user_id;

    // ✅ Convert path_coords → latlong string for PostgreSQL
    if (Array.isArray(patrolData.path_coords)) {
      patrolData.latlong = patrolData.path_coords
        .map(coord => `${coord.longitude} ${coord.latitude}`)
        .join(', ');
    }

    // ✅ Extract files
    const files = req.files || [];
    const patrolImages = [];
    const incidentImages = {};

    files.forEach(file => {
      if (file.fieldname === 'patrol_images') {
        patrolImages.push(file.originalname);
      } else if (file.fieldname.startsWith('incident_')) {
        const match = file.fieldname.match(/incident_(\d+)/);
        if (match) {
          const idx = parseInt(match[1]) - 1;
          if (!incidentImages[idx]) incidentImages[idx] = [];
          incidentImages[idx].push(file.originalname);
        }
      }
    });

    // ✅ Attach patrol team images to patrol data
    if (patrolImages.length > 0) {
      patrolData.patrol_images = patrolImages;
    }

    // ✅ Attach uploaded images to each incident
    incidentsData.forEach((incident, i) => {
      if (incidentImages[i]) {
        incident.images = incidentImages[i];
      } else if (incident.image_filenames) {
        // Use filenames provided in JSON if no uploads
        incident.images = incident.image_filenames;
      }
    });

    // ✅ Clean & format timestamps
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

    // ✅ Call the PostgreSQL function
    const query = `
      SELECT * FROM create_full_incident(
        :patrol_data,
        :incidents_data,
        :user_id
      );
    `;

    const result = await sequelize.query(query, {
      replacements: {
        patrol_data: JSON.stringify(patrolData),
        incidents_data: JSON.stringify(incidentsData),
        user_id: userId
      },
      type: sequelize.QueryTypes.SELECT
    });

    if (result && result.length > 0) {
      res.status(201).json({
        message: '✅ Patrol and incident data inserted successfully',
        patrol_id: result[0].patrol_id,
        incident_ids: result[0].incident_ids,
        patrol_images_count: patrolImages.length,
        incident_images_count: Object.values(incidentImages).flat().length
      });
    } else {
      res.status(400).json({ error: 'Failed to insert data. No result returned.' });
    }

  } catch (error) {
    console.error('❌ API call failed:', error);
    res.status(500).json({ error: 'Failed to create full incident entry.' });
  }
});



// ===========================================================
// 🔹 API: Get incidents with images and categories by user_id
// ===========================================================
app.get('/api/incidents-with-images', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing required query parameter: user_id' });

    const query = 'SELECT * FROM get_incidents_with_details(:user_id);';
    const [results] = await sequelize.query(query, { replacements: { user_id } });

        // The PostgreSQL function's JSONB_AGG will return a single [null] if no images exist.
        // This processes the results to return an empty array instead.
        const processedResults = results.map(row => ({
            ...row,
            image_urls: row.image_urls && row.image_urls[0] === null ? [] : row.image_urls
        }));

    res.json(processed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error retrieving incidents with images' });
  }
});

// ===========================================================
// 🔹 API: Get patrols by user
// ===========================================================
app.get('/api/patrols-by-user', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing required query parameter: user_id' });

    const results = await sequelize.query('SELECT * FROM get_patrols_by_user(:user_id)', {
      replacements: { user_id },
      type: Sequelize.QueryTypes.SELECT,
    });

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



// -------------------------------------------------------------------
// CASCADING DROPDOWN ROUTES (Already Corrected in previous step)
// -------------------------------------------------------------------



// 1. Get DISTINCT Working Circles (NEW first step)
app.get('/api/working-circles', async (req, res) => {
    try {
        // Renaming the route to be consistent with the first dropdown.
        const results = await sequelize.query('SELECT wc_name FROM get_all_wcs()', {
            type: Sequelize.QueryTypes.SELECT
        });
        res.json(results);
    } catch (err) {
        console.error('Error fetching working circles:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



app.get('/api/districts', async (req, res) => {
    const { workingCircle } = req.query;
    if (!workingCircle)
        return res.status(400).json({ error: 'Working Circle parameter is required' });

    try {
        const results = await sequelize.query(
            'SELECT district_name FROM get_districts_by_wc(:workingCircle)',
            {
                replacements: { workingCircle },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        res.json(results);
    } catch (err) {
        console.error('Error fetching districts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// 2. Get DISTINCT Divisions (Filtered by Working Circle)
app.get('/api/divisions', async (req, res) => {
    const { workingCircle, district } = req.query;
    if (!workingCircle || !district)
        return res.status(400).json({ error: 'Working Circle and District parameters are required' });

    try {
        const results = await sequelize.query(
            'SELECT division_name FROM get_divisions_by_wc_district(:workingCircle, :district)',
            {
                replacements: { workingCircle, district },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        res.json(results);
    } catch (err) {
        console.error('Error fetching divisions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// 3. Get DISTINCT Ranges (Filtered by WC and Division)
app.get('/api/ranges', async (req, res) => {
    const { workingCircle, district, division } = req.query;
    if (!workingCircle || !district || !division)
        return res.status(400).json({ error: 'Working Circle, District, and Division parameters are required' });

    try {
        const results = await sequelize.query(
            'SELECT range_name FROM get_ranges_by_wc_district_division(:workingCircle, :district, :division)',
            {
                replacements: { workingCircle, district, division },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        res.json(results);
    } catch (err) {
        console.error('Error fetching ranges:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// 4. Get DISTINCT Beats (Filtered by WC, Division, and Range)
app.get('/api/beats', async (req, res) => {
    const { workingCircle, district, division, range } = req.query;
    if (!workingCircle || !district || !division || !range)
        return res.status(400).json({ error: 'Working Circle, District, Division, and Range parameters are required' });

    try {
        const results = await sequelize.query(
            'SELECT beat_name FROM get_beats_by_wc_district_division_range(:workingCircle, :district, :division, :range)',
            {
                replacements: { workingCircle, district, division, range },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        res.json(results);
    } catch (err) {
        console.error('Error fetching beats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});







// 5. Final Data View
app.get('/api/coupes', async (req, res) => {
    const { division, range, beat, wc } = req.query;
    if (!division || !range || !beat || !wc)
        return res.status(400).json({ error: 'All parameters (Division, Range, Beat, WC) are required' });

    try {
        const sql = `
            SELECT * FROM public.merged_coupe_filter1
            WHERE division = :division AND range = :range AND beat = :beat AND wc = :wc;
        `;
        const results = await sequelize.query(sql, {
            replacements: { division, range, beat, wc },
            type: Sequelize.QueryTypes.SELECT // ✅ FIXED
        });
        res.json(results);
    } catch (err) {
        console.error('Error fetching final coupe data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/api/ndvi-change-summary', async (req, res) => {
    // 1. Define the function call
    const functionCall = 'SELECT change_type, category_count, percentage_of_total FROM public.get_ndvi_change_summary();';

    try {
        // 2. Execute the function call using Sequelize with the correct QueryType.
        //    A raw SELECT query with QueryTypes.SELECT returns an array of results.
        const results = await sequelize.query(functionCall, {
            type: Sequelize.QueryTypes.SELECT
        });
        
        // 3. Respond with the full results array.
        //    The 'results' variable here already holds the array of row objects.
        res.json(results);
    } catch (error) {
        console.error('Error fetching NDVI change summary:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve NDVI change summary. Check the function definition and database connection.',
            details: error.message
        });
    }
});

// Start server and connect to DB
const PORT = 5000;
app.listen(PORT, async () => {
    await dbConnect();
    console.log(`Server is running on port ${PORT}`);
});



