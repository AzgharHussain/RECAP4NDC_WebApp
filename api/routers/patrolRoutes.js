const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const jwt = require("jsonwebtoken");
const { verifyJwt } = require("../middlewares/verifyJwt"); 
const { clean } = require("../middlewares/sanitize");
const MongoImage = require("../models/Image");
const { logFromRequest } = require("../utils/auditLogger");


const router = express.Router();

// PostgreSQL connection pool — sized for high concurrency
const client = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL_MAX || 50),
  min: 5,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
  options: '-c datestyle=ISO,YMD',
});
client.on('connect', (pgClient) => {
  pgClient.query("SET datestyle = 'ISO, YMD'").catch((err) => {
    console.error('Failed to set PostgreSQL DateStyle:', err.message);
  });
});
client.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});
client.query('SELECT 1')
  .then(async () => {
    console.log('Database connected');
    try {
      const connectionResult = await client.query(`
        SELECT current_database() AS database_name, current_user AS database_user, inet_server_addr() AS server_ip, inet_server_port() AS server_port, current_setting('DateStyle') AS date_style
      `);
      console.log('[patrols startup] database connection:', connectionResult.rows[0]);

      const sampleResult = await client.query(`
        SELECT patrol_id, start_time, end_time, start_time::text AS start_time_raw, end_time::text AS end_time_raw
        FROM public.patrols
        ORDER BY start_time DESC NULLS LAST, patrol_id DESC
        LIMIT 5
      `);
      console.log('[patrols startup] date parse sample:', sampleResult.rows);
    } catch (err) {
      console.log('[patrols startup] failed to log patrol date sample:', err.message);
    }
  })
  .catch((err) => console.log('Database not connected:', err.message));

// Multer memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});


function formatPatrolTimestamp(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}

function parseToUTC(dateValue) {
  return new Date(dateValue).toISOString();
}

async function ensurePatrolLocationColumns(dbClient = client) {
  await dbClient.query(`
    ALTER TABLE public.patrols
      ADD COLUMN IF NOT EXISTS patrolling_location TEXT,
      ADD COLUMN IF NOT EXISTS current_location_distict TEXT,
      ADD COLUMN IF NOT EXISTS current_location_village TEXT;
  `);
}

ensurePatrolLocationColumns().catch((err) => {
  console.error('Failed to ensure patrol location columns:', err.message);
});

// POST route for patrol with multiple images (no notes)
router.post('/patrol-post', verifyJwt, upload.any(), async (req, res) => {
  const pat_data = req.body;

  pat_data.patrol_officer_name = clean(pat_data.patrol_officer_name);
pat_data.start_location = clean(pat_data.start_location);
pat_data.end_location = clean(pat_data.end_location);
pat_data.beat = clean(pat_data.beat);
pat_data.range = clean(pat_data.range);
pat_data.division = clean(pat_data.division);
pat_data.patrolling_location = clean(pat_data.patrolling_location || pat_data.patrolling_Location || pat_data.patrollingLocation);
pat_data.current_location_distict = clean(pat_data.current_location_distict || pat_data.current_location_district || pat_data.currentLocationDistrict);
pat_data.current_location_village = clean(pat_data.current_location_village || pat_data.currentLocationVillage);

  if (!pat_data.patrolling_location) pat_data.patrolling_location = 'Inside Forest';
  const patrolLocationType = String(pat_data.patrolling_location || '').trim().toLowerCase();
  const isOutsideForest = patrolLocationType === 'outside forest' || patrolLocationType === 'outside';
  const requiredFields = [
    'patrol_officer_name', 
    'start_time', 
    'end_time', 
    'start_location', 
    'end_location', 
    'distance_kms', 
    'geom', 
    'user_id', 
    'patrolling_type_id', 
    'number_of_staff'
  ];

  if (isOutsideForest) {
    requiredFields.push('current_location_distict', 'current_location_village');
  } else {
    requiredFields.push('beat', 'range', 'division');
  }

  for (let field of requiredFields) {
    if (!pat_data[field])
      return res.status(400).json({ error: `Missing field: ${field}` });
  }

  if (pat_data.distance_kms < 0 || isNaN(pat_data.distance_kms) || !isFinite(pat_data.distance_kms)) {
    return res.status(400).json({ 
      error: 'Invalid distance value', 
      message: 'Distance must be a valid non-negative number' 
    });
  }

    // SIMPLE FILE VALIDATION - Block SVG files
  if (req.files && req.files.length > 0) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif', 'application/octet-stream', 'image/heic-sequence'];
    
    for (let file of req.files) {
      // Check if file type is allowed
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          message: 'Only JPG, PNG, GIF, HEIC, and HEIF images are allowed. SVG files are not permitted.' 
        });
      }
      
      // Check file extension
      const fileName = file.originalname.toLowerCase();
      if (fileName.endsWith('.svg') || fileName.endsWith('.svgz')) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          message: 'SVG files are not allowed due to security reasons.' 
        });
      }
    }
  }

  try {
    // First check if user exists in government_department_users
    const userCheckQuery = `
      SELECT user_id FROM government_department_users 
      WHERE user_id = $1
    `;
    
    const userCheck = await client.query(userCheckQuery, [pat_data.user_id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in government department users' });
    }

    const startUTC = parseToUTC(pat_data.start_time);
    const endUTC = parseToUTC(pat_data.end_time);

    // Acquire a dedicated connection for the transaction
    const txClient = await client.connect();

    try {
      // Start a transaction
      await txClient.query('BEGIN');

      await ensurePatrolLocationColumns(txClient);

      const query1 = `
        INSERT INTO patrols (
          patrol_officer_name, 
          start_time, 
          end_time,
          start_location, 
          end_location, 
          distance_kms, 
          geom,
          user_id, 
          patrolling_type_id, 
          number_of_staff,
          beat,
          range,
          division,
          patrolling_location,
          current_location_distict,
          current_location_village
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING patrol_id;
      `;

      const result = await txClient.query(query1, [
        pat_data.patrol_officer_name,
        startUTC,
        endUTC,
        pat_data.start_location,
        pat_data.end_location,
        pat_data.distance_kms,
        pat_data.geom,
        pat_data.user_id,
        pat_data.patrolling_type_id,
        pat_data.number_of_staff,
        pat_data.beat,
        pat_data.range,
        pat_data.division,
        pat_data.patrolling_location,
        pat_data.current_location_distict,
        pat_data.current_location_village
      ]);

      const patrol_id = result.rows[0].patrol_id;

      // Insert images into MongoDB if files are uploaded
      if (req.files && req.files.length > 0) {
        const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
        let nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;

        const imageDocs = req.files.map((file, i) => {
          const base64Image = file.buffer.toString('base64');
          const imageCategory =
            i === 0 ? 'start_image' :
            i === 1 ? 'end_image' :
            `image_${i - 1}`;

          return {
            imageId: nextId++,
            sourceType: 'patrol',
            patrolId: patrol_id,
            imageCategory,
            imageType: file.mimetype,
            imageData: base64Image,
          };
        });

        await MongoImage.insertMany(imageDocs);
      }

      // Commit transaction
      await txClient.query('COMMIT');
      
      logFromRequest(req, {
        action: 'RECORD_CREATE',
        status: 'SUCCESS',
        statusCode: 200,
        userId: pat_data.user_id,
        resourceType: 'patrol',
        resourceId: patrol_id,
        details: { officer: pat_data.patrol_officer_name, beat: pat_data.beat, distance: pat_data.distance_kms },
      });

      res.json({ message: 'Data created successfully', patrol_id });

    } catch (err) {
      // Rollback transaction on error
      await txClient.query('ROLLBACK');
      throw err;
    } finally {
      txClient.release();
    }

  } catch (err) {
    console.error(err);

    logFromRequest(req, {
      action: 'RECORD_CREATE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      resourceType: 'patrol',
      errorMessage: err.message,
    });
    res.status(500).json({ error: 'Data insertion failed' });
  }
});


router.get('/patrol-info-all', verifyJwt, async (req, res) => {
  try {
    // Removed unnecessary GROUP BY — the LEFT JOIN is 1:1, no duplicates.
    // Added timeout to prevent blocking the event loop on large tables.
    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ORDER BY p.start_time DESC NULLS LAST, p.patrol_id DESC;
    `;

    const result = await client.query({ text: query, timeout: 30000 });

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time),
     
    }));

    res.json({ message: 'All patrols fetched successfully', data: formattedData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});
// GET all patrols with images and notes
router.get('/patrol-info', verifyJwt, async (req, res) => {
  try {
    // Removed unnecessary GROUP BY — LEFT JOIN is 1:1, no duplicates.
    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ORDER BY p.patrol_id DESC
      LIMIT 5;
    `;

    const result = await client.query({ text: query, timeout: 30000 });

    const patrolIds = result.rows.map(p => p.patrol_id);
    let imagesMap = {};
    if (patrolIds.length > 0) {
      const mongoImages = await MongoImage.find({ sourceType: 'patrol', patrolId: { $in: patrolIds } }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        if (!acc[img.patrolId]) acc[img.patrolId] = [];
        acc[img.patrolId].push({
          image_id: img.imageId,
          image_data: img.imageData,
          image_type: img.imageType,
          image_category: img.imageCategory,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({

  ...patrol,

  // 🔹 Sanitize output fields
  patrol_officer_name: clean(patrol.patrol_officer_name),
  start_location: clean(patrol.start_location),
  end_location: clean(patrol.end_location),
  beat: clean(patrol.beat),
  range: clean(patrol.range),
  division: clean(patrol.division),
  patrolling_location: clean(patrol.patrolling_location),
  current_location_distict: clean(patrol.current_location_distict),
  current_location_village: clean(patrol.current_location_village),

  start_time: formatPatrolTimestamp(patrol.start_time),
  end_time: formatPatrolTimestamp(patrol.end_time),

  images: (imagesMap[patrol.patrol_id] || []).map(img => ({
    ...img,
    image_data: img.image_data || null
  }))

}));


    res.json({ message: 'All patrols fetched successfully', data: formattedData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});


// Updated /patrol-info endpoint with pagination
router.get('/patrol-info-page', verifyJwt, async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Get filter parameters
    const { 
      officer_name, 
      start_date, 
      end_date, 
      type_name,
      division,
      range,
      round,
      beat,
      forest_id 
    } = req.query;

    // Build WHERE clause dynamically based on filters
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Helper function to add conditions
    const addCondition = (field, operator, value) => {
      if (value) {
        conditions.push(`${field} ${operator} $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    };
// Validate officer_name
if (officer_name) {
  const namePattern = /^[a-zA-Z\s.-]{1,100}$/;

  if (!namePattern.test(officer_name)) {
    return res.status(400).json({
      error: "Invalid officer_name. Only letters, spaces, dot and hyphen allowed."
    });
  }
}
    // Add filters with appropriate operators
    if (officer_name) {
      conditions.push(`p.patrol_officer_name ILIKE $${paramIndex}`);
      values.push(`%${officer_name}%`);
      paramIndex++;
    }

   // In your backend, when receiving date filters
if (start_date) {
  // start_date might be "2026-03-17 00:00:00"
  conditions.push(`p.start_time >= $${paramIndex}`);
  values.push(start_date);
  paramIndex++;
}

if (end_date) {
  // end_date might be "2026-03-17 23:59:59"
  conditions.push(`p.end_time <= $${paramIndex}`);
  values.push(end_date);
  paramIndex++;
}

    if (type_name) {
      conditions.push(`pt.type_name = $${paramIndex}`);
      values.push(type_name);
      paramIndex++;
    }

    if (division) {
      conditions.push(`p.division = $${paramIndex}`);
      values.push(division);
      paramIndex++;
    }

    if (range) {
      conditions.push(`p.range = $${paramIndex}`);
      values.push(range);
      paramIndex++;
    }

    if (round) {
      conditions.push(`p.round = $${paramIndex}`);
      values.push(round);
      paramIndex++;
    }

    if (beat) {
      conditions.push(`p.beat = $${paramIndex}`);
      values.push(beat);
      paramIndex++;
    }

    if (forest_id) {
      conditions.push(`p.forest_id = $${paramIndex}`);
      values.push(forest_id);
      paramIndex++;
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Main query with pagination and filters (no image JOIN)
    // Removed unnecessary GROUP BY — it forced a full sort/hash aggregation
    // that made this query take 40-60 seconds. DISTINCT is not needed since
    // the LEFT JOIN on patrolling_types is 1:1 (one type per patrol).
    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      ORDER BY p.start_time DESC NULLS LAST, p.patrol_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    // Add limit and offset to values array
    values.push(limit, offset);

    // Count query for total records with same filters
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause};
    `;

    // Execute both queries with a 30-second timeout to prevent blocking the event loop
    const queryTimeout = 30000;
    const [result, countResult] = await Promise.all([
      client.query({ text: query, values, timeout: queryTimeout }),
      client.query({ text: countQuery, values: values.slice(0, -2), timeout: queryTimeout })
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch images from MongoDB for the patrols on this page
    const patrolIds = result.rows.map(p => p.patrol_id);
    let imagesMap = {};
    if (patrolIds.length > 0) {
      const mongoImages = await MongoImage.find({ sourceType: 'patrol', patrolId: { $in: patrolIds } }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        if (!acc[img.patrolId]) acc[img.patrolId] = [];
        acc[img.patrolId].push({
          image_id: img.imageId,
          image_data: img.imageData,
          image_type: img.imageType,
          image_category: img.imageCategory,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time),
      images: imagesMap[patrol.patrol_id] || []
    }));

    res.json({ 
      message: 'Patrols fetched successfully',
      data: formattedData,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (err) {
    console.error('Error fetching patrols:', err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});

// Optional: Add API endpoint for filtered pagination
router.get('/patrol-info/filter', verifyJwt, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 5,
      type_name,
      officer_name,
      start_date,
      end_date,
      division,
      range,
      beat,
      round,
      location,
      coupe,
      forest_id
    } = req.query;

    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 5;
    const offsetInt = (pageInt - 1) * limitInt;

    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // -----------------------------
    // FILTER CONDITIONS
    // -----------------------------

    if (type_name) {
      whereConditions.push(`pt.type_name = $${paramIndex}`);
      queryParams.push(type_name);
      paramIndex++;
    }

    if (officer_name) {
      whereConditions.push(`p.patrol_officer_name ILIKE $${paramIndex}`);
      queryParams.push(`%${officer_name}%`);
      paramIndex++;
    }

    // Combined location search
    if (location) {
      whereConditions.push(`(
        p.division ILIKE $${paramIndex}
        OR p.range ILIKE $${paramIndex}
        OR p.beat ILIKE $${paramIndex}
        OR p.round ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${location}%`);
      paramIndex++;
    } else {
      if (division) {
        whereConditions.push(`p.division = $${paramIndex}`);
        queryParams.push(division);
        paramIndex++;
      }

      if (range) {
        whereConditions.push(`p.range = $${paramIndex}`);
        queryParams.push(range);
        paramIndex++;
      }

      if (beat) {
        whereConditions.push(`p.beat = $${paramIndex}`);
        queryParams.push(beat);
        paramIndex++;
      }

      if (round) {
        whereConditions.push(`p.round = $${paramIndex}`);
        queryParams.push(round);
        paramIndex++;
      }
    }

    if (coupe) {
      whereConditions.push(`p.coupe_name = $${paramIndex}`);
      queryParams.push(coupe);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`DATE(p.start_time) >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`DATE(p.end_time) <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    if (forest_id) {
      whereConditions.push(`p.forest_id = $${paramIndex}`);
      queryParams.push(forest_id);
      paramIndex++;
    }

    // -----------------------------
    // WHERE CLAUSE
    // -----------------------------

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // -----------------------------
    // ADD PAGINATION SAFELY
    // -----------------------------

    const limitIndex = paramIndex;
    queryParams.push(limitInt);
    paramIndex++;

    const offsetIndex = paramIndex;
    queryParams.push(offsetInt);
    paramIndex++;

    // -----------------------------
    // MAIN QUERY
    // -----------------------------

    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.start_time DESC NULLS LAST
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    // -----------------------------
    // COUNT QUERY
    // -----------------------------

    const countQuery = `
      SELECT COUNT(DISTINCT p.patrol_id) AS total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause};
    `;

    const countParams = queryParams.slice(0, -2);

    // -----------------------------
    // EXECUTE QUERIES
    // -----------------------------

    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, countParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count) || 0;
    const totalPages = Math.ceil(totalCount / limitInt);

    // -----------------------------
    // RESPONSE FORMAT
    // -----------------------------

    // Fetch images from MongoDB for the patrols on this page
    const patrolIds = result.rows.map(p => p.patrol_id);
    let imagesMap = {};
    if (patrolIds.length > 0) {
      const mongoImages = await MongoImage.find({ sourceType: 'patrol', patrolId: { $in: patrolIds } }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        if (!acc[img.patrolId]) acc[img.patrolId] = [];
        acc[img.patrolId].push({
          image_id: img.imageId,
          image_data: img.imageData,
          image_type: img.imageType,
          image_category: img.imageCategory,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time),
      images: imagesMap[patrol.patrol_id] || []
    }));

    res.json({
      message: 'Filtered patrols fetched successfully',
      data: formattedData,
      pagination: {
        currentPage: pageInt,
        pageSize: limitInt,
        totalItems: totalCount,
        totalPages,
        hasNextPage: pageInt < totalPages,
        hasPreviousPage: pageInt > 1
      }
    });

  } catch (err) {
    console.error('Error in filtered patrol search:', err);
    res.status(500).json({
      error: 'Failed to fetch filtered patrols',
      details: err.message
    });
  }
});

router.get('/patrol-info-user/:user_id', verifyJwt, async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      WHERE p.user_id = $1
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.patrol_id DESC;
    `;

    const result = await client.query(query, [user_id]);

    const patrolIds = result.rows.map(p => p.patrol_id);
    let imagesMap = {};
    if (patrolIds.length > 0) {
      const mongoImages = await MongoImage.find({ sourceType: 'patrol', patrolId: { $in: patrolIds } }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        if (!acc[img.patrolId]) acc[img.patrolId] = [];
        acc[img.patrolId].push({
          image_id: img.imageId,
          image_data: img.imageData,
          image_type: img.imageType,
          image_category: img.imageCategory,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time),
      images: (imagesMap[patrol.patrol_id] || []).map(img => ({
        ...img,
        image_data: img.image_data || null
      }))
    }));

    res.json({ 
      message: 'Patrols fetched successfully for user', 
      data: formattedData 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});

router.get('/patrols/:patrol_id', verifyJwt, async (req, res) => {
  const { patrol_id } = req.params;

  try {
    const query = `
      SELECT
        p.*,
        pt.type_name
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      WHERE p.patrol_id = $1
      GROUP BY p.patrol_id, pt.type_name;
    `;

    const result = await client.query(query, [patrol_id]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Patrol not found' });

    const patrol = result.rows[0];

    const mongoImages = await MongoImage.find({ sourceType: 'patrol', patrolId: parseInt(patrol_id) }).lean();
    const images = mongoImages.map(img => ({
      image_id: img.imageId,
      image_data: img.imageData || null,
      image_type: img.imageType,
      image_category: img.imageCategory,
      note: img.note,
    }));

    const formattedPatrol = {
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time),
      images
    };

    res.json({ message: 'Patrol fetched successfully', data: formattedPatrol });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrol' });
  }
});

// GET all patrolling types
router.get('/patrolling-types', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT type_id, type_name
      FROM patrolling_types
      ORDER BY type_id;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling types fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling types' });
  }
});

router.get('/patrolling-division', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT division
      FROM patrols;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling division fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling division' });
  }
});

router.get('/patrolling-range', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT range
      FROM patrols;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling ranges fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling ranges' });
  }
});

router.get('/patrolling-beat', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT beat
      FROM patrols;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling beats fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling beats' });
  }
});

router.get('/patrolling-round', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT round
      FROM patrols;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling rounds fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling rounds' });
  }
});

// Get ranges filtered by division
router.get('/patrolling-range-by-division', verifyJwt, async (req, res) => {
  try {
    const { division } = req.query;
    
    let query = `
      SELECT DISTINCT range
      FROM patrols
    `;
    
    const values = [];
    
    if (division) {
      query += ` WHERE division = $1`;
      values.push(division);
    }
    
    query += ` ORDER BY range`;
    
    const result = await client.query(query, values);
    res.json({
      message: 'Patrolling ranges fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling ranges' });
  }
});

// Get beats filtered by range (and optionally division)
router.get('/patrolling-beat-by-range', verifyJwt, async (req, res) => {
  try {
    const { range, division } = req.query;
    
    let query = `
      SELECT DISTINCT beat
      FROM patrols
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;
    
    if (range) {
      query += ` AND range = $${paramIndex}`;
      values.push(range);
      paramIndex++;
    }
    
    if (division) {
      query += ` AND division = $${paramIndex}`;
      values.push(division);
      paramIndex++;
    }
    
    query += ` ORDER BY beat`;
    
    const result = await client.query(query, values);
    res.json({
      message: 'Patrolling beats fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling beats' });
  }
});

// Alternative: Single endpoint to get all hierarchy data at once
router.get('/patrolling-hierarchy', async (req, res) => {
  try {
    const { division, range, beat } = req.query;
    let query = `
      SELECT DISTINCT division, range, beat, round
      FROM patrols
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    
    if (division) {
      query += ` AND division = $${paramCount}`;
      params.push(division);
      paramCount++;
    }
    
    if (range) {
      query += ` AND range = $${paramCount}`;
      params.push(range);
      paramCount++;
    }
    
    if (beat) {
      query += ` AND beat = $${paramCount}`;
      params.push(beat);
      paramCount++;
    }
    
    query += ` ORDER BY division, range, beat, round`;
    
    const result = await client.query(query, params);
    res.json({
      message: 'Patrolling hierarchy fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling hierarchy' });
  }
});

router.get('/patrolling-drb', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT range, beat,division
      FROM patrols;
    `;
    const result = await client.query(query);
    res.json({
      message: 'All patrolling districts fetched successfully',
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrolling districts' });
  }
});



module.exports = router;