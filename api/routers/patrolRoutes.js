const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const jwt = require("jsonwebtoken");
const { verifyJwt } = require("../middlewares/verifyJwt"); 

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
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
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

    // Main query with pagination
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
      LIMIT $1 OFFSET $2;
    `;

    // Count query for total records
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
    `;

    // Execute both queries in parallel
    const [result, countResult] = await Promise.all([
      client.query(query, [limit, offset]),
      client.query(countQuery)
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limit);

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
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});

// Optional: Add API endpoint for filtered pagination
router.get('/patrol-info/filter', verifyJwt, async (req, res) => {
  try {
    const {
      page = 1,
      limit =5,
      type_name,
      officer_name,
      start_date,
      end_date,
      division,
      beat
    } = req.query;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // Build WHERE clause dynamically
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

    if (division) {
      whereConditions.push(`p.division_name ILIKE $${paramIndex}`);
      queryParams.push(`%${division}%`);
      paramIndex++;
    }

    if (beat) {
      whereConditions.push(`p.beat_name ILIKE $${paramIndex}`);
      queryParams.push(`%${beat}%`);
      paramIndex++;
    }

    // Add pagination parameters
    queryParams.push(limit, offset);

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

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

    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM patrols p
      LEFT JOIN patrolling_types pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
    `;

    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limit);

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
      message: 'Filtered patrols fetched successfully',
      data: formattedData,
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalItems: totalCount,
        totalPages: totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch filtered patrols' });
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

router.get('/patrolling-district', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT division
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