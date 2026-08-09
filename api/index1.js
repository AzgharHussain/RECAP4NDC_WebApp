// const { Sequelize } = require('sequelize');
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const patrolRoutes = require('./routers/patrolRoutes');
// const dropdownapis = require('./routers/dropdownapis');
 
// const { sequelize, testConnection } = require('./config/database');
// const NdviRouter =require("./routers/ndviRouter")
// const notifications = require('./routers/notifications');
// const userlocations = require('./routers/userlocations');
// const changendvi = require('./routers/changendvi');
// const beat_patrol_coverage = require('./routers/beat-patrol-coverage');
 
// // ===========================================================
// // 🧩 DATABASE CONNECTION (PostgreSQL + Sequelize)
// // ===========================================================
 
// // const sequelize = new Sequelize(
// //   'GIZ',          // Database name
// //   'postgres',     // Username
// //   'pass@123',     // Password
// //   {
// //     host: 'localhost',
// //     dialect: 'postgres',
// //   }
// // );
 
 
 
 
 
// // const sequelize = new Sequelize(
// //   'Recap4NDC', // Database name
// //   'postgres', // Username
// //   'DB@$ecure#25', // Password
// //   {
// //     host: '68.178.167.39',
// //     dialect: 'postgres',
// //     logging: console.log, // Enable logging to see SQL queries
// //     dialectOptions: {
// //       ssl: false, // Disable SSL since server doesn't support it
// //     },
// //     pool: {
// //       max: 5,
// //       min: 0,
// //       acquire: 30000,
// //       idle: 10000
// //     }
// //   }
// // );
 
// // // Test connection
// // sequelize.authenticate()
// //   .then(() => {
// //     console.log('✅ Database connection established successfully.');
// //   })
// //   .catch(err => {
// //     console.error('❌ Unable to connect to the database:', err);
// //   });
 
 
// // module.exports = sequelize ;
// // ===========================================================
// // ⚙️ EXPRESS APP SETUP
// // ===========================================================
// const app = express();
// app.use(cors());
// app.use(express.json());

// // const { sequelize } = require('../config/ndvidatabase');
 
// const axios = require("axios");
// const xml2js = require("xml2js");
 
// /* ---------------- XML PARSER ---------------- */
// const parser = new xml2js.Parser({
//   explicitArray: true,
//   ignoreAttrs: false,
//   tagNameProcessors: [xml2js.processors.stripPrefix], // removes soap12:, diffgr:
// });
 
 
 
// // ===========================================================
// // 📁 SETUP FOLDERS (Patrolimage + Incidentimage)
// // ===========================================================
// const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
// const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');
 
// // Ensure directories exist
// if (!fs.existsSync(patrolImageDir)) fs.mkdirSync(patrolImageDir, { recursive: true });
// if (!fs.existsSync(incidentImageDir)) fs.mkdirSync(incidentImageDir, { recursive: true });
 
// // Serve images statically
// app.use('/Patrolimage', express.static(patrolImageDir));
// app.use('/Incidentimage', express.static(incidentImageDir));
// app.use('/api', notifications);
// app.use('/api', userlocations);
// app.use('/api', changendvi);
// // ===========================================================
// // 📦 MULTER STORAGE SETUP (Dynamic folder selection)
// // ===========================================================
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     if (file.fieldname.startsWith('patrol_images')) {
//       cb(null, patrolImageDir);
//     } else if (file.fieldname.startsWith('incident_')) {
//       cb(null, incidentImageDir);
//     } else {
//       cb(null, incidentImageDir);
//     }
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   }
// });
 
// const upload = multer({ storage });
 
// app.use(express.json({ limit: '50mb' })); // For parsing application/json
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
 
// app.use('/api', patrolRoutes);
// app.use('/api', dropdownapis);
// app.use('/api', NdviRouter);
// app.use('/api', beat_patrol_coverage);
 
// // ===========================================================
// // ✅ TEST ROUTE
// // ===========================================================
// app.get('/', (req, res) => {
//   res.send('Server is running and connected to PostgreSQL 🚀');
// });
 
// // ===========================================================
// // 🔹 API: Get all incident categories
// // ===========================================================
// app.get('/api/incident-categories', async (req, res) => {
//   try {
//     const [result] = await sequelize.query('SELECT * FROM get_all_incident_categories()');
//     res.json(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error retrieving incident categories' });
//   }
// });
 
// // ===========================================================
// // 🔹 API: Create Patrol + Incidents + Upload Images
// // ===========================================================
// app.post('/api/full-incident', upload.any(), async (req, res) => {
//   try {
//     if (!req.body.patrol || !req.body.incidents || !req.body.user_id) {
//       return res.status(400).json({ error: 'Missing patrol, incidents, or user_id in request body.' });
//     }
 
//     const patrolData = JSON.parse(req.body.patrol);
//     const incidentsData = JSON.parse(req.body.incidents);
//     const userId = req.body.user_id;
 
//     // ✅ Convert path_coords → latlong string for PostgreSQL
//     if (Array.isArray(patrolData.path_coords)) {
//       patrolData.latlong = patrolData.path_coords
//         .map(coord => `${coord.longitude} ${coord.latitude}`)
//         .join(', ');
//     }
 
//     // ✅ Extract files
//     const files = req.files || [];
//     const patrolImages = [];
//     const incidentImages = {};
 
//     files.forEach(file => {
//       if (file.fieldname === 'patrol_images') {
//         patrolImages.push(file.originalname);
//       } else if (file.fieldname.startsWith('incident_')) {
//         const match = file.fieldname.match(/incident_(\d+)/);
//         if (match) {
//           const idx = parseInt(match[1]) - 1;
//           if (!incidentImages[idx]) incidentImages[idx] = [];
//           incidentImages[idx].push(file.originalname);
//         }
//       }
//     });
 
//     // ✅ Attach patrol team images to patrol data
//     if (patrolImages.length > 0) {
//       patrolData.patrol_images = patrolImages;
//     }
 
//     // ✅ Attach uploaded images to each incident
//     incidentsData.forEach((incident, i) => {
//       if (incidentImages[i]) {
//         incident.images = incidentImages[i];
//       } else if (incident.image_filenames) {
//         // Use filenames provided in JSON if no uploads
//         incident.images = incident.image_filenames;
//       }
//     });
 
//     // ✅ Clean & format timestamps
//     if (patrolData.start_time) {
//       patrolData.start_time = new Date(patrolData.start_time).toISOString();
//     }
//     if (patrolData.end_time) {
//       patrolData.end_time = new Date(patrolData.end_time).toISOString();
//     }
//     incidentsData.forEach(incident => {
//       if (incident.incident_time) {
//         incident.incident_time = new Date(incident.incident_time).toISOString();
//       }
//     });
 
//     // ✅ Call the PostgreSQL function
//     const query = `
//       SELECT * FROM create_full_incident(
//         :patrol_data,
//         :incidents_data,
//         :user_id
//       );
//     `;
 
//     const result = await sequelize.query(query, {
//       replacements: {
//         patrol_data: JSON.stringify(patrolData),
//         incidents_data: JSON.stringify(incidentsData),
//         user_id: userId
//       },
//       type: sequelize.QueryTypes.SELECT
//     });
 
//     if (result && result.length > 0) {
//       res.status(201).json({
//         message: '✅ Patrol and incident data inserted successfully',
//         patrol_id: result[0].patrol_id,
//         incident_ids: result[0].incident_ids,
//         patrol_images_count: patrolImages.length,
//         incident_images_count: Object.values(incidentImages).flat().length
//       });
//     } else {
//       res.status(400).json({ error: 'Failed to insert data. No result returned.' });
//     }
 
//   } catch (error) {
//     console.error('❌ API call failed:', error);
//     res.status(500).json({ error: 'Failed to create full incident entry.' });
//   }
// });
 
 
 
// // ===========================================================
// // 🔹 API: Get incidents with images and categories by user_id
// // ===========================================================
// app.get('/api/incidents-with-images', async (req, res) => {
//   try {
//     const { user_id } = req.query;
//     if (!user_id) return res.status(400).json({ error: 'Missing required query parameter: user_id' });
 
//     const query = 'SELECT * FROM get_incidents_with_details(:user_id);';
//     const [results] = await sequelize.query(query, { replacements: { user_id } });
 
//     const processed = results.map(row => ({
//       ...row,
//       image_urls_: row.image_urls && row.image_urls[0] === null ? [] : row.image_urls
//     }));
 
//     res.json(processed);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error retrieving incidents with images' });
//   }
// });
 
// // ===========================================================
// // 🔹 API: Get patrols by user
// // ===========================================================
// app.get('/api/patrols-by-user', async (req, res) => {
//   try {
//     const { user_id } = req.query;
//     if (!user_id) return res.status(400).json({ error: 'Missing required query parameter: user_id' });
 
//     const results = await sequelize.query('SELECT * FROM get_patrols_by_user(:user_id)', {
//       replacements: { user_id },
//       type: Sequelize.QueryTypes.SELECT,
//     });
 
//     res.json(results);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error retrieving patrols' });
//   }
// });

// /* ---------------- LOGIN API ---------------- */
// app.post("/login-eguj", async (req, res) => {
//   const { username, password } = req.body;
 
//   /* --------- Input validation --------- */
//   if (!username || !password) {
//     return res.status(400).json({
//       success: false,
//       error: "Username and password are required",
//     });
//   }
 
//   /* --------- SOAP XML --------- */
//   const soapXML = `<?xml version="1.0" encoding="utf-8"?>
// <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
//                    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
//                    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
// <soap12:Body>
// <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
// <username>${username}</username>
// <password>${password}</password>
// </LOGIN_EGUJFOREST>
// </soap12:Body>
// </soap12:Envelope>`;
 
//   try {
//     /* --------- SOAP CALL --------- */
//     const response = await axios.post(
//       "https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx",
//       soapXML,
//       {
//         headers: {
//           "Content-Type": "application/soap+xml; charset=utf-8",
//           SOAPAction: "http://tempuri.org/LOGIN_EGUJFOREST",
//           "User-Agent": "Mozilla/5.0", // IMPORTANT for gov servers
//           Accept: "*/*",
//         },
//         timeout: 15000, // 15 seconds
//       }
//     );
 
//     /* --------- Parse XML --------- */
//     const parsed = await parser.parseStringPromise(response.data);
 
//     const envelope = parsed.Envelope;
//     const body = envelope?.Body?.[0];
 
//     /* --------- SOAP Fault check --------- */
//     if (body?.Fault) {
//       const faultMsg =
//         body.Fault[0]?.Reason?.[0]?.Text?.[0] ||
//         body.Fault[0]?.faultstring?.[0];
 
//       console.error("SOAP FAULT:", faultMsg);
//       return res.status(401).json({
//         success: false,
//         error: faultMsg || "Authentication failed",
//       });
//     }
 
//     /* --------- Result extraction --------- */
//     const loginResult =
//       body?.LOGIN_EGUJFORESTResponse?.[0]?.LOGIN_EGUJFORESTResult?.[0];
 
//     if (!loginResult) {
//       console.error("Invalid SOAP response structure");
//       return res.status(401).json({
//         success: false,
//         error: "Invalid server response",
//       });
//     }
 
//     const diffgram = loginResult.diffgram?.[0]?.DocumentElement?.[0]?.Result?.[0];
 
//     if (!diffgram) {
//       return res.status(401).json({
//         success: false,
//         error: "Invalid username or password",
//       });
//     }
 
//     /* --------- Validate login --------- */
//     const invalidValues = ["", "-", "NULL", null, undefined];
//     if (invalidValues.includes(diffgram.NAME?.[0]?.trim())) {
//       return res.status(401).json({
//         success: false,
//         error: "Invalid username or password",
//       });
//     }
 
//     /* --------- Extract user data --------- */
//     const fields = [
//       "NAME",
//       "NameOfPost",
//       "CadreName",
//       "CircleName",
//       "DivisionName",
//       "RangeName",
//       "RoundName",
//       "BeatName",
//       "MobileNo",
//       "EmailID",
//     ];
 
//     const userData = {};
//     fields.forEach((f) => {
//       let value = diffgram[f]?.[0];
//       userData[f] = invalidValues.includes(value) ? null : value;
//     });
 
//     /* --------- Save user --------- */
//     let user_id = null;
//     try {
//       const [result] = await sequelize.query(
//         `
//         INSERT INTO government_department_users (username)
//         VALUES ($1)
//         ON CONFLICT (username)
//         DO UPDATE SET username = EXCLUDED.username
//         RETURNING user_id
//         `,
//         { bind: [username] }
//       );
 
//       user_id = result?.[0]?.user_id || null;
//     } catch (dbErr) {
//       console.error("DB ERROR:", dbErr.message);
//     }
 
//     userData.user_id = user_id;
//     userData.username = username;
 
//     /* --------- SUCCESS --------- */
//     return res.json({
//       success: true,
//       message: "Login successful",
//       user: userData,
//     });
 
//   } catch (error) {
//     console.error("LOGIN ERROR:", {
//       message: error.message,
//       code: error.code,
//       url: error.config?.url,
//     });
 
//     return res.status(500).json({
//       success: false,
//       error: "Government service unreachable",
//     });
//   }
// });

// app.get("/api/villages", async (req, res) => {
//   try {
//     const { name } = req.query;

//     if (!name) {
//       return res.status(400).json({ error: "name is required" });
//     }

//     const query = `
//       SELECT DISTINCT village_name, id
//       FROM public.coupe_village_master
//       WHERE coupe_name = '${name}'
//     `;

//     const result =  await sequelize.query(query, [name]);

//     res.json({
//       success: true,
//       data: result[0],
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// // ===========================================================
// // 🚀 START SERVER
// // ===========================================================
// const PORT = 5002;
// app.listen(PORT, async () => {
 
//   console.log(`🚀 Server running on port ${PORT}`);
// });
 
'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// const { Sequelize } = require('sequelize');
const { sequelize } = require('./config/database');

// Routers
const patrolRoutes = require('./routers/patrolRoutes');
const dropdownapis = require('./routers/dropdownapis');
const NdviRouter = require('./routers/ndviRouter');
const notifications = require('./routers/notifications');
const userlocations = require('./routers/userlocations');
const changendvi = require('./routers/changendvi');
const beat_patrol_coverage = require('./routers/beat-patrol-coverage');

const app = express();

/* =========================================================
   🔐 PRODUCTION MIDDLEWARE
========================================================= */

// Enable CORS (lock domains in real prod)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ SINGLE JSON PARSER (DO NOT DUPLICATE)
app.use(express.json());

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

/* =========================================================
   📥 REQUEST LOGGER (SAFE FOR PROD)
========================================================= */
app.use((req, res, next) => {
  next();
});

/* =========================================================
   📁 FILE STORAGE (MULTER)
========================================================= */
const patrolImageDir = path.join(__dirname, '..', 'Patrolimage');
const incidentImageDir = path.join(__dirname, '..', 'Incidentimage');

if (!fs.existsSync(patrolImageDir)) fs.mkdirSync(patrolImageDir, { recursive: true });
if (!fs.existsSync(incidentImageDir)) fs.mkdirSync(incidentImageDir, { recursive: true });

app.use('/Patrolimage', express.static(patrolImageDir));
app.use('/Incidentimage', express.static(incidentImageDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.startsWith('patrol_images')) {
      cb(null, patrolImageDir);
    } else {
      cb(null, incidentImageDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/* =========================================================
   🚦 ROUTES
========================================================= */


const jwt = require("jsonwebtoken");
const SECRET_KEY = "your-secret-key-change-in-production";

app.post("/api/saveuser", async (req, res) => {

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  try {

    const [users] = await sequelize.query(
      `SELECT user_id, username
       FROM public.government_department_users
       WHERE username = $1`,
      { bind: [username] }
    );


    let user;

    if (users.length > 0) {
      user = users[0];
    } else {

      const [result] = await sequelize.query(
        `INSERT INTO public.government_department_users (username)
         VALUES ($1)
         RETURNING user_id, username`,
        { bind: [username] }
      );

      user = result[0];
    }


    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
      },
      SECRET_KEY,
      { expiresIn: "24h" }
    );


    return res.status(200).json({
      success: true,
      message: users.length > 0 ? "User already exists" : "User created",
      user,
      token,
    });

  } catch (error) {
    console.error("🔥 ERROR in /api/saveuser:", error);

    // Duplicate username handling
    if (error.code === "23505") {

      try {
        const [users] = await sequelize.query(
          `SELECT user_id, username
           FROM public.government_department_users
           WHERE username = $1`,
          { bind: [username] }
        );

        if (users.length > 0) {
          const user = users[0];

          const token = jwt.sign(
            { userId: user.user_id, username: user.username },
            SECRET_KEY,
            { expiresIn: "24h" }
          );


          return res.status(200).json({
            success: true,
            message: "User already exists",
            user,
            token,
          });
        }
      } catch (fetchError) {
        console.error("❌ Failed fetching existing user:", fetchError);
      }
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
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


/* =========================================================
   ❌ GLOBAL ERROR HANDLER (PRODUCTION REQUIRED)
========================================================= */
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong'
  });
});

/* =========================================================
   🚀 START SERVER
========================================================= */
const PORT = 5002;

app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
  } catch (e) {
    console.error('❌ Database connection failed', e);
  }

});
