const { Sequelize } = require('sequelize');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const patrolRoutes = require('./routers/patrolRoutes');
const dropdownapis = require('./routers/dropdownapis');

const { sequelize, testConnection } = require('./config/database');
const NdviRouter =require("./routers/ndviRouter")
const notifications = require('./routers/notifications');

// ===========================================================
// 🧩 DATABASE CONNECTION (PostgreSQL + Sequelize)
// ===========================================================

// const sequelize = new Sequelize(
//   'GIZ',          // Database name
//   'postgres',     // Username
//   'pass@123',     // Password
//   {
//     host: 'localhost',
//     dialect: 'postgres',
//   }
// );





// const sequelize = new Sequelize(
//   'Recap4NDC', // Database name
//   'postgres', // Username
//   'DB@$ecure#25', // Password
//   {
//     host: '68.178.167.39',
//     dialect: 'postgres',
//     logging: console.log, // Enable logging to see SQL queries
//     dialectOptions: {
//       ssl: false, // Disable SSL since server doesn't support it
//     },
//     pool: {
//       max: 5,
//       min: 0,
//       acquire: 30000,
//       idle: 10000
//     }
//   }
// );

// // Test connection
// sequelize.authenticate()
//   .then(() => {
//     console.log('✅ Database connection established successfully.');
//   })
//   .catch(err => {
//     console.error('❌ Unable to connect to the database:', err);
//   });


// module.exports = sequelize ;
// ===========================================================
// ⚙️ EXPRESS APP SETUP
// ===========================================================
const app = express();
app.use(cors());
app.use(express.json());



// ===========================================================
// 📁 SETUP FOLDERS (Patrolimage + Incidentimage)
// ===========================================================
const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');

// Ensure directories exist
if (!fs.existsSync(patrolImageDir)) fs.mkdirSync(patrolImageDir, { recursive: true });
if (!fs.existsSync(incidentImageDir)) fs.mkdirSync(incidentImageDir, { recursive: true });

// Serve images statically
app.use('/Patrolimage', express.static(patrolImageDir));
app.use('/Incidentimage', express.static(incidentImageDir));
app.use('/api', notifications);

// ===========================================================
// 📦 MULTER STORAGE SETUP (Dynamic folder selection)
// ===========================================================
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

app.use(express.json({ limit: '50mb' })); // For parsing application/json
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', patrolRoutes);
app.use('/api', dropdownapis);
app.use('/api', NdviRouter)

// ===========================================================
// ✅ TEST ROUTE
// ===========================================================
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

    const processed = results.map(row => ({
      ...row,
      image_urls_: row.image_urls && row.image_urls[0] === null ? [] : row.image_urls
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

// ===========================================================
// 🚀 START SERVER 
// ===========================================================
const PORT = 5000;
app.listen(PORT, async () => {

  console.log(`🚀 Server running on port ${PORT}`);
});
