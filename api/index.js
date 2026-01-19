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
const userlocations = require('./routers/userlocations');
const changendvi = require('./routers/changendvi');
const beat_patrol_coverage = require('./routers/beat-patrol-coverage');

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
app.use('/api', userlocations);
app.use('/api', changendvi);
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
app.use('/api', NdviRouter);
app.use('/api', beat_patrol_coverage);

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
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
// const { sequelize } = require('../config/ndvidatabase');

app.post("/login-eguj", async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: "Username and password are required" 
    });
  }

  const soapXML = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap12:Body>
</soap12:Envelope>`;

  try {
    const response = await fetch(
      "https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/LOGIN_EGUJFOREST",
        },
        body: soapXML,
      }
    );

    const text = await response.text();
    
    // Parse XML using xml2js
    parser.parseString(text, (err, result) => {
      if (err) {
        console.error("XML Parsing Error:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to parse server response"
        });
      }
      
      // Check for SOAP fault
      const faultstring = result['soap:Envelope']?.['soap:Body']?.[0]?.['soap:Fault']?.[0]?.faultstring?.[0] ||
                         result['soap12:Envelope']?.['soap12:Body']?.[0]?.['soap12:Fault']?.[0]?.Reason?.[0]?.Text?.[0];
      
      if (faultstring) {
        return res.status(401).json({
          success: false,
          error: faultstring
        });
      }
      
      // Extract the LOGIN_EGUJFORESTResult
      const loginResult = result['soap:Envelope']?.['soap:Body']?.[0]?.['LOGIN_EGUJFORESTResponse']?.[0]?.['LOGIN_EGUJFORESTResult']?.[0] ||
                         result['soap12:Envelope']?.['soap12:Body']?.[0]?.['LOGIN_EGUJFORESTResponse']?.[0]?.['LOGIN_EGUJFORESTResult']?.[0];
      
      if (!loginResult) {
        return res.status(401).json({
          success: false,
          error: "Invalid server response format"
        });
      }
      
      // Get the diffgram data
      const diffgram = loginResult['diffgr:diffgram']?.[0]?.DocumentElement?.[0];
      if (!diffgram || !diffgram.Result) {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password"
        });
      }
      
      const resultData = diffgram.Result[0];
      
      // Check if NAME field exists and is not empty or dash
      if (!resultData.NAME || !resultData.NAME[0] || 
          resultData.NAME[0].trim() === "" || 
          resultData.NAME[0].trim() === "-" ||
          resultData.NAME[0].trim() === "NULL") {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password"
        });
      }
      
      // Also check if ALL fields are dashes (invalid login case)
      const fieldsToCheck = ["NAME", "NameOfPost", "CadreName"];
      const allInvalid = fieldsToCheck.every(field => {
        const value = resultData[field]?.[0];
        return !value || value.trim() === "" || value.trim() === "-" || value.trim() === "NULL";
      });
      
      if (allInvalid) {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password"
        });
      }
      
      // Extract all user data
      const userData = {};
      const fields = ["NAME", "NameOfPost", "CadreName", "CircleName", "DivisionName", 
                      "RangeName", "RoundName", "BeatName", "MobileNo", "EmailID"];
      
      fields.forEach(field => {
        let value = resultData[field] ? resultData[field][0] : null;
        // Convert dash to null for consistency
        if (value === "-" || value === "NULL") {
          value = null;
        }
        userData[field] = value;
      });

      // Function to save only username to database with auto-increment user_id
      const saveUserToDatabase = async (username) => {
        try {
          // Create table if not exists with SERIAL user_id
          await sequelize.query(`
            CREATE TABLE IF NOT EXISTS government_department_users (
              user_id SERIAL PRIMARY KEY,
              username VARCHAR(100) UNIQUE NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Insert or ignore if username already exists and RETURNING user_id
          const [result] = await sequelize.query(`
            INSERT INTO government_department_users (username) 
            VALUES ($1)
            ON CONFLICT (username) 
            DO UPDATE SET username = EXCLUDED.username
            RETURNING user_id
          `, {
            bind: [username]
          });

          if (result && result.length > 0) {
            const user_id = result[0].user_id;
            console.log(`User saved/retrieved: ${username} with user_id: ${user_id}`);
            return user_id;
          } else {
            // If no result (shouldn't happen with RETURNING), fetch existing user_id
            const [existingUser] = await sequelize.query(`
              SELECT user_id FROM government_department_users 
              WHERE username = $1
            `, {
              bind: [username]
            });
            
            if (existingUser && existingUser.length > 0) {
              const user_id = existingUser[0].user_id;
              console.log(`Existing user retrieved: ${username} with user_id: ${user_id}`);
              return user_id;
            }
            
            console.error(`Failed to retrieve user_id for: ${username}`);
            return null;
          }
        } catch (dbError) {
          console.error("Database Error:", dbError);
          return null;
        }
      };

      // Process login - save user and get user_id
      const processLogin = async () => {
        try {
          // Save user to database and get user_id
          const user_id = await saveUserToDatabase(username);
          
          if (!user_id) {
            console.error("Failed to get user_id for user:", username);
            // Still allow login even if DB fails, but with null user_id
          }
          
          // Add user_id to userData
          userData.user_id = user_id;
          userData.username = username; // Also include username in userData
          
          // Return successful response with user_id
          res.json({
            success: true,
            user: userData,
            message: "Login successful"
          });
        } catch (processError) {
          console.error("Login processing error:", processError);
          
          // Even if DB fails, allow login with null user_id
          userData.user_id = null;
          userData.username = username;
          
          res.json({
            success: true,
            user: userData,
            message: "Login successful (database operation failed)"
          });
        }
      };

      // Start the login processing
      processLogin();
    });
    
  } catch (error) {
    console.error("SOAP Request Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to process login request",
      details: error.message 
    });
  }
});

app.get("/api/villages", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const query = `
      SELECT DISTINCT village_name, id
      FROM public.coupe_village_master
      WHERE coupe_name = '${name}'
    `;

    const result =  await sequelize.query(query, [name]);

    res.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ===========================================================
// 🚀 START SERVER 
// ===========================================================
const PORT = 5002;
app.listen(PORT, async () => {

  console.log(`🚀 Server running on port ${PORT}`);
});



