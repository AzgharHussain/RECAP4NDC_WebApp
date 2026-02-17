const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const jwt = require("jsonwebtoken");
const { verifyJwt } = require("../middlewares/verifyJwt"); 
const { clean } = require("../middlewares/sanitize");


const router = express.Router();

// PostgreSQL client
const client = new Client({
  host: '68.178.167.216',
  user: 'postgres',
  password: 'P$DB@25%$#!26',
  port: 5432,
  database: 'Recap4NDC'
});
client.connect()
  .then(() => console.log('Database connected'))
  .catch(() => console.log('Database not connected'));

// Multer memory storage
const storage = multer.memoryStorage();
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp"
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"), false);
    }
    cb(null, true);
  }
});


function toUTC(dateValue) {
  return new Date(dateValue).toISOString();
}

function parseToUTC(dateValue) {
  return new Date(dateValue).toISOString();
}

// POST route for patrol with multiple images (no notes)
router.post('/patrol-post', verifyJwt, upload.any(), async (req, res) => {
  const pat_data = req.body;

  pat_data.patrol_officer_name = clean(pat_data.patrol_officer_name);
pat_data.start_location = clean(pat_data.start_location);
pat_data.end_location = clean(pat_data.end_location);
pat_data.beat = clean(pat_data.beat);
pat_data.range = clean(pat_data.range);
pat_data.division = clean(pat_data.division);

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
    'number_of_staff',
    'beat',          // Added beat as required field
    'range',         // Added range as required field
    'division'       // Added division as required field
  ];

  for (let field of requiredFields) {
    if (!pat_data[field])
      return res.status(400).json({ error: `Missing field: ${field}` });
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

    // Start a transaction
    await client.query('BEGIN');

    try {
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
          beat,           -- Added beat column
          range,          -- Added range column
          division        -- Added division column
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING patrol_id;
      `;

      const result = await client.query(query1, [
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
        pat_data.beat,      // Added beat value
        pat_data.range,     // Added range value
        pat_data.division   // Added division value
      ]);

      const patrol_id = result.rows[0].patrol_id;

      // Insert images if files are uploaded
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const base64Image = file.buffer.toString('base64');

          const imageCategory =
            i === 0 ? 'start_image' :
            i === 1 ? 'end_image' :
            `image_${i - 1}`;

          await client.query(
            `INSERT INTO patrol_images (image_data, image_type, patrol_id, image_category)
             VALUES ($1, $2, $3, $4)`,
            [base64Image, file.mimetype, patrol_id, imageCategory]
          );
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      
      res.json({ message: 'Data created successfully', patrol_id });

    } catch (err) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Data insertion failed' });
  }
});


router.get('/patrol-info-all', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT
        p.*,
        pt.type_name
       
      FROM patrols p
     
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.patrol_id DESC;
    `;

    const result = await client.query(query);

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: toUTC(patrol.start_time),
      end_time: toUTC(patrol.end_time),
     
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
    const query = `
      SELECT
        p.*,
        pt.type_name,
        json_agg(
          json_build_object(
            'image_id', pi.image_id,
            'image_data', pi.image_data,
            'image_type', pi.image_type,
            'image_category', pi.image_category,
            'note', pi.note
          )
        ) AS images
      FROM patrols p
      LEFT JOIN patrol_images pi ON p.patrol_id = pi.patrol_id
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.patrol_id DESC
      LIMIT 5;
    `;

    const result = await client.query(query);

    const formattedData = result.rows.map(patrol => ({

  ...patrol,

  // 🔹 Sanitize output fields
  patrol_officer_name: clean(patrol.patrol_officer_name),
  start_location: clean(patrol.start_location),
  end_location: clean(patrol.end_location),
  beat: clean(patrol.beat),
  range: clean(patrol.range),
  division: clean(patrol.division),

  start_time: toUTC(patrol.start_time),
  end_time: toUTC(patrol.end_time),

  images: patrol.images.map(img => ({
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

    // Add filters with appropriate operators
    if (officer_name) {
      conditions.push(`p.patrol_officer_name ILIKE $${paramIndex}`);
      values.push(`%${officer_name}%`);
      paramIndex++;
    }

    if (start_date) {
      conditions.push(`DATE(p.start_time) >= $${paramIndex}`);
      values.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions.push(`DATE(p.end_time) <= $${paramIndex}`);
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

    // Main query with pagination and filters
    const query = `
      SELECT
        p.*,
        pt.type_name,
        json_agg(
          json_build_object(
            'image_id', pi.image_id,
            'image_data', pi.image_data,
            'image_type', pi.image_type,
            'image_category', pi.image_category,
            'note', pi.note
          )
        ) AS images
      FROM patrols p
      LEFT JOIN patrol_images pi ON p.patrol_id = pi.patrol_id
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.patrol_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    // Add limit and offset to values array
    values.push(limit, offset);

    // Count query for total records with same filters
    const countQuery = `
      SELECT COUNT(DISTINCT p.patrol_id) as total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause};
    `;

    // Execute both queries
    const [result, countResult] = await Promise.all([
      client.query(query, values),
      client.query(countQuery, values.slice(0, -2)) // Remove limit and offset for count query
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limit);

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: toUTC(patrol.start_time),
      end_time: toUTC(patrol.end_time),
      images: patrol.images.filter(img => img.image_id !== null) // Remove null images from aggregation
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

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // Type filter
    if (type_name) {
      whereConditions.push(`pt.type_name = $${paramIndex}`);
      queryParams.push(type_name);
      paramIndex++;
    }

    // Officer name search
    if (officer_name) {
      whereConditions.push(`p.patrol_officer_name ILIKE $${paramIndex}`);
      queryParams.push(`%${officer_name}%`);
      paramIndex++;
    }

    // COMBINED LOCATION SEARCH - searches across division, range, and beat
    if (location) {
      whereConditions.push(`(
        p.division ILIKE $${paramIndex} OR 
        p.range ILIKE $${paramIndex} OR 
        p.beat ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${location}%`);
      paramIndex++;
    }

    // Individual filters (from dropdown selections)
    if (division && !location) {
      whereConditions.push(`p.division = $${paramIndex}`);
      queryParams.push(division);
      paramIndex++;
    }

    if (range && !location) {
      whereConditions.push(`p.range = $${paramIndex}`);
      queryParams.push(range);
      paramIndex++;
    }

    if (beat && !location) {
      whereConditions.push(`p.beat = $${paramIndex}`);
      queryParams.push(beat);
      paramIndex++;
    }
    
    if (round && !location) {
      whereConditions.push(`p.round = $${paramIndex}`);
      queryParams.push(round);
      paramIndex++;
    }

    if (coupe) {
      whereConditions.push(`p.coupe_name = $${paramIndex}`);
      queryParams.push(coupe);
      paramIndex++;
    }

    // Date filters
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

    // Forest ID filter
    if (forest_id) {
      whereConditions.push(`p.forest_id = $${paramIndex}`);
      queryParams.push(forest_id);
      paramIndex++;
    }

    // IMPORTANT: Parse limit and offset to integers before adding to queryParams
    const limitInt = parseInt(limit);
    const offsetInt = parseInt(offset);
    
    // Add pagination parameters as numbers
    queryParams.push(limitInt, offsetInt);

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Main query
    const query = `
      SELECT
        p.*,
        pt.type_name,
        COALESCE(
          json_agg(
            json_build_object(
              'image_id', pi.image_id,
              'image_data', pi.image_data,
              'image_type', pi.image_type,
              'image_category', pi.image_category,
              'note', pi.note
            ) ORDER BY pi.image_id
          ) FILTER (WHERE pi.image_id IS NOT NULL),
          '[]'::json
        ) AS images
      FROM patrols p
      LEFT JOIN patrol_images pi ON p.patrol_id = pi.patrol_id
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.start_time DESC
      LIMIT $${paramIndex - 2} OFFSET $${paramIndex - 1};
    `;

    // For count query, remove the pagination parameters
    const countParams = queryParams.slice(0, -2);
    
    const countQuery = `
      SELECT COUNT(DISTINCT p.patrol_id) as total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
    `;

    console.log('Executing query with params:', queryParams);
    console.log('Count query params:', countParams);
    
    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, countParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limitInt);

    // Format the response
    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: patrol.start_time,
      end_time: patrol.end_time,
      images: Array.isArray(patrol.images) ? patrol.images : []
    }));

    res.json({
      message: 'Filtered patrols fetched successfully',
      data: formattedData,
      pagination: {
        currentPage: parseInt(page),
        pageSize: limitInt,
        totalItems: totalCount,
        totalPages: totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
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
        pt.type_name,
        json_agg(
          json_build_object(
            'image_id', pi.image_id,
            'image_data', pi.image_data,
            'image_type', pi.image_type,
            'image_category', pi.image_category,
            'note', pi.note
          )
        ) AS images
      FROM patrols p
      LEFT JOIN patrol_images pi ON p.patrol_id = pi.patrol_id
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      WHERE p.user_id = $1
      GROUP BY p.patrol_id, pt.type_name
      ORDER BY p.patrol_id DESC;
    `;

    const result = await client.query(query, [user_id]);

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: toUTC(patrol.start_time),
      end_time: toUTC(patrol.end_time),
      images: patrol.images.map(img => ({
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
        pt.type_name,
        json_agg(
          json_build_object(
            'image_id', pi.image_id,
            'image_data', pi.image_data,
            'image_type', pi.image_type,
            'image_category', pi.image_category,
            'note', pi.note
          )
        ) AS images
      FROM patrols p
      LEFT JOIN patrol_images pi ON p.patrol_id = pi.patrol_id
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      WHERE p.patrol_id = $1
      GROUP BY p.patrol_id, pt.type_name;
    `;

    const result = await client.query(query, [patrol_id]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Patrol not found' });

    const patrol = result.rows[0];

    const formattedPatrol = {
      ...patrol,
      start_time: toUTC(patrol.start_time),
      end_time: toUTC(patrol.end_time),
      images: patrol.images.map(img => ({
        ...img,
        image_data: img.image_data || null
      }))
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

// Get distinct ranges based on selected division
// router.get('/patrolling-range', async (req, res) => {
//   try {
//     const { division } = req.query;
//     let query = `
//       SELECT DISTINCT range
//       FROM patrols
//     `;
//     const params = [];
    
//     if (division) {
//       query += ` WHERE division = $1`;
//       params.push(division);
//     }
    
//     const result = await client.query(query, params);
//     res.json({
//       message: 'All patrolling ranges fetched successfully',
//       data: result.rows
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch patrolling ranges' });
//   }
// });

// Get distinct beats based on selected division and range
// router.get('/patrolling-beat', async (req, res) => {
//   try {
//     const { division, range } = req.query;
//     let query = `
//       SELECT DISTINCT beat
//       FROM patrols
//     `;
//     const params = [];
    
//     if (division) {
//       query += ` AND division = $${paramCount}`;
//       params.push(division);
//       paramCount++;
//     }
    
//     if (range) {
//       query += ` AND range = $${paramCount}`;
//       params.push(range);
//       paramCount++;
//     }
    
//     const result = await client.query(query, params);
//     res.json({
//       message: 'All patrolling beats fetched successfully',
//       data: result.rows
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch patrolling beats' });
//   }
// });

// Get distinct rounds based on selected division, range, and beat
// router.get('/patrolling-round', async (req, res) => {
//   try {
//     const { division, range, beat } = req.query;
//     let query = `
//       SELECT DISTINCT round
//       FROM patrols
//       WHERE 1=1
//     `;
//     const params = [];
//     let paramCount = 1;
    
//     if (division) {
//       query += ` AND division = $${paramCount}`;
//       params.push(division);
//       paramCount++;
//     }
    
//     if (range) {
//       query += ` AND range = $${paramCount}`;
//       params.push(range);
//       paramCount++;
//     }
    
//     if (beat) {
//       query += ` AND beat = $${paramCount}`;
//       params.push(beat);
//       paramCount++;
//     }
    
//     const result = await client.query(query, params);
//     res.json({
//       message: 'All patrolling rounds fetched successfully',
//       data: result.rows
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch patrolling rounds' });
//   }
// });

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