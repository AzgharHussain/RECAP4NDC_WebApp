const express = require('express');
const multer = require('multer');
const { verifyJwt } = require('../middlewares/verifyJwt');
const { clean } = require('../middlewares/sanitize');
const MongoImage = require('../models/Image');
const { logFromRequest } = require('../utils/auditLogger');
const { sequelize } = require('../config/database');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// Same thin adapter used in patrolRoutes — delegates to the
// single Sequelize connection pool.
// ─────────────────────────────────────────────────────────
const client = {
  query: async (sql, params) => {
    if (sql && typeof sql === 'object' && !Array.isArray(sql)) {
      params = sql.values || params;
      sql = sql.text;
    }
    const trimmed = sql.trim().toUpperCase();
    let queryType;
    if (/^SELECT/.test(trimmed)) queryType = sequelize.QueryTypes.SELECT;
    else if (/^INSERT/.test(trimmed)) queryType = sequelize.QueryTypes.INSERT;
    else if (/^UPDATE/.test(trimmed)) queryType = sequelize.QueryTypes.UPDATE;
    else if (/^DELETE/.test(trimmed)) queryType = sequelize.QueryTypes.DELETE;
    else queryType = sequelize.QueryTypes.RAW;
    const options = { raw: true, type: queryType };
    if (params) {
      const safeParams = (Array.isArray(params) ? params : [params]).map(v => v === undefined ? null : v);
      options.bind = safeParams;
    }
    const result = await sequelize.query(sql, options);
    let rows;
    if (queryType === sequelize.QueryTypes.SELECT) {
      rows = Array.isArray(result) ? result : (result ? [result] : []);
    } else if (Array.isArray(result[0])) {
      rows = result[0];
    } else if (result[0] !== null && result[0] !== undefined) {
      rows = [result[0]];
    } else {
      rows = [];
    }
    return { rows };
  },
};

// Multer memory storage (same as patrol routes)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─────────────────────────────────────────────────────────
// Auto-create positive_incident_logs table when this module
// loads (i.e. when the server starts and requires this router)
// ─────────────────────────────────────────────────────────
async function ensurePositiveIncidentLogsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.positive_incident_logs (
      incident_id          SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL,
      incident_type       VARCHAR(255) NOT NULL DEFAULT 'Positive',
      incident_category_id INTEGER,
      incident_subcategory VARCHAR(255),
      division            VARCHAR(255),
      range_name           VARCHAR(255),
      round                VARCHAR(255),
      beat                 VARCHAR(255),
      village              VARCHAR(255),
      incident_date       DATE NOT NULL,
      incident_time       TIME NOT NULL,
      description         TEXT,
      incident_code        VARCHAR(100) UNIQUE,
      created_at          TIMESTAMP DEFAULT NOW(),
      updated_at          TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add columns if they don't exist (for existing tables)
  await client.query(`
    ALTER TABLE public.positive_incident_logs
      ADD COLUMN IF NOT EXISTS incident_category_id INTEGER,
      ADD COLUMN IF NOT EXISTS incident_subcategory VARCHAR(255),
      ADD COLUMN IF NOT EXISTS division VARCHAR(255),
      ADD COLUMN IF NOT EXISTS range_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS round VARCHAR(255),
      ADD COLUMN IF NOT EXISTS beat VARCHAR(255),
      ADD COLUMN IF NOT EXISTS village VARCHAR(255),
      ADD COLUMN IF NOT EXISTS incident_code VARCHAR(100) UNIQUE;
  `);

  // Index for fast lookup by user_id
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_positive_incident_logs_user_id
    ON public.positive_incident_logs (user_id);
  `);

  // Index for fast lookup by category
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_positive_incident_logs_category_id
    ON public.positive_incident_logs (incident_category_id);
  `);

  // Index for fast lookup by incident_code
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_positive_incident_logs_code
    ON public.positive_incident_logs (incident_code);
  `);
}

// Primary worker only — avoid every cluster worker racing the same DDL.
if (require('../utils/isPrimaryWorker')) {
  ensurePositiveIncidentLogsTable().catch((err) => {
    console.error('Failed to ensure positive_incident_logs table:', err.message);
  });
}

// ─────────────────────────────────────────────────────────
// Generate a human-readable incident_code:
//   <DIVISION>-<USERNAME>-<YYYYMMDD>-<HHMM>-<INCIDENT_ID>
// Same structure as incident_logs codes.
// ─────────────────────────────────────────────────────────
function sanitizeCodePart(value, maxLen = 15) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, maxLen) || 'unknown';
}

function generateIncidentCode(division, username, incidentDate, incidentTime, incidentId) {
  // Build a Date from incident_date + incident_time
  let d;
  if (incidentDate && incidentTime) {
    d = new Date(`${incidentDate} ${incidentTime}`);
  } else if (incidentDate) {
    d = new Date(incidentDate);
  } else {
    d = new Date();
  }
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const div = sanitizeCodePart(division, 5).toUpperCase();
  const usr = sanitizeCodePart(username, 15);
  return `${div}-${usr}-${date}-${time}-${incidentId}`;
}

// ─────────────────────────────────────────────────────────
// CREATE — POST /api/positive-incident-logs
// Body (multipart/form-data):
//   user_id, incident_date, incident_time, description
//   (incident_type optional — defaults to 'Positive')
//   file: incident_image (single image)
// ─────────────────────────────────────────────────────────
router.post('/positive-incident-logs', verifyJwt, upload.single('incident_image'), async (req, res) => {
  const { user_id, incident_type, incident_category_id, incident_subcategory, division, range_name, round, beat, village, incident_date, incident_time, description } = req.body;

  // Validate required fields
  if (!user_id || !incident_date || !incident_time) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: user_id, incident_date, incident_time',
    });
  }

  // File type validation
  if (req.file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only JPG, PNG, GIF, HEIC images are allowed.',
      });
    }
    const fileName = req.file.originalname.toLowerCase();
    if (fileName.endsWith('.svg') || fileName.endsWith('.svgz')) {
      return res.status(400).json({
        success: false,
        error: 'SVG files are not allowed.',
      });
    }
  }

  try {
    // Check if user exists
    const userCheck = await client.query(
      'SELECT user_id, username FROM public.government_department_users WHERE user_id = $1',
      [user_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Sanitize text fields. Fall back to the logged-in user's hierarchy
    // (from JWT) when the client omits division/range/round/beat — older
    // incident forms didn't send these, so backfill from the user's own
    // level so reports can show the hierarchy for every incident.
    const cleanType = incident_type ? clean(incident_type) : 'Positive';
    const cleanSubcategory = incident_subcategory ? clean(incident_subcategory) : null;
    const cleanDesc = description ? clean(description) : null;
    const cleanDivision = division ? clean(division) : (req.user?.division ? clean(req.user.division) : null);
    const cleanRange = range_name ? clean(range_name) : (req.user?.range ? clean(req.user.range) : null);
    const cleanRound = round ? clean(round) : (req.user?.round ? clean(req.user.round) : null);
    const cleanBeat = beat ? clean(beat) : (req.user?.beat ? clean(req.user.beat) : null);
    const cleanVillage = village ? clean(village) : null;
    const categoryId = incident_category_id ? Number(incident_category_id) : null;

    // Insert into PostgreSQL
    const insertQuery = `
      INSERT INTO public.positive_incident_logs (user_id, incident_type, incident_category_id, incident_subcategory, division, range_name, round, beat, village, incident_date, incident_time, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING incident_id, user_id, incident_type, incident_category_id, incident_subcategory, division, range_name, round, beat, village, incident_date, incident_time, description, created_at;
    `;
    const result = await client.query(insertQuery, [
      user_id,
      cleanType,
      categoryId,
      cleanSubcategory,
      cleanDivision,
      cleanRange,
      cleanRound,
      cleanBeat,
      cleanVillage,
      incident_date,
      incident_time,
      cleanDesc,
    ]);

    const incident_id = result.rows[0].incident_id;

    // Generate and persist a human-readable incident_code
    // Format: <DIVISION>-<USERNAME>-<YYYYMMDD>-<HHMM>-<INCIDENT_ID>
    const incident_code = generateIncidentCode(
      cleanDivision,
      userCheck.rows[0].username || req.user?.username,
      incident_date,
      incident_time,
      incident_id
    );
    if (incident_code) {
      await client.query(
        'UPDATE public.positive_incident_logs SET incident_code = $1 WHERE incident_id = $2',
        [incident_code, incident_id]
      );
      result.rows[0].incident_code = incident_code;
    }

    // Store image in MongoDB if uploaded
    if (req.file) {
      const base64Image = req.file.buffer.toString('base64');
      const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
      const nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;

      await MongoImage.create({
        imageId: nextId,
        sourceType: 'positive_incident',
        recordId: incident_id,
        imageCategory: 'incident_image',
        imageType: req.file.mimetype,
        imageData: base64Image,
        note: cleanDesc,
      });
    }

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_CREATE',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'positive_incident_log',
      resourceId: incident_id,
      details: { incident_type: cleanType, incident_date },
    });

    res.status(201).json({
      success: true,
      message: 'Positive incident log created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[positive-incident-logs POST] Error:', err.message);

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_CREATE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      resourceType: 'positive_incident_log',
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to create positive incident log', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// READ ALL — GET /api/positive-incident-logs
// Returns all positive incident logs with their images from MongoDB
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-logs', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT
        il.incident_id,
        il.user_id,
        il.incident_type,
        il.incident_category_id,
        ic.category_name,
        il.incident_subcategory,
        il.division,
        il.range_name,
        il.round,
        il.beat,
        il.village,
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.incident_code,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.positive_incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      LEFT JOIN public.positive_incident_categories ic ON il.incident_category_id = ic.category_id
      ORDER BY il.created_at DESC;
    `;
    const result = await client.query(query);

    // Fetch images from MongoDB for all incidents
    const incidentIds = result.rows.map((r) => r.incident_id);
    let imagesMap = {};
    if (incidentIds.length > 0) {
      const mongoImages = await MongoImage.find({
        sourceType: 'positive_incident',
        recordId: { $in: incidentIds },
      }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        const rid = img.recordId;
        if (!acc[rid]) acc[rid] = [];
        acc[rid].push({
          image_id: img.imageId,
          image_category: img.imageCategory,
          image_type: img.imageType,
          image_data: img.imageData,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const data = result.rows.map((row) => ({
      ...row,
      incident_image: imagesMap[row.incident_id] || [],
    }));

    res.json({ success: true, message: 'Positive incident logs fetched successfully', data });
  } catch (err) {
    console.error('[positive-incident-logs GET all] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch positive incident logs' });
  }
});

// ─────────────────────────────────────────────────────────
// READ BY USER ID — GET /api/positive-incident-logs/user/:user_id
// Returns all positive incident logs for a specific user with images
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-logs/user/:user_id', verifyJwt, async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  try {
    const query = `
      SELECT
        il.incident_id,
        il.user_id,
        il.incident_type,
        il.incident_category_id,
        ic.category_name,
        il.incident_subcategory,
        il.division,
        il.range_name,
        il.round,
        il.beat,
        il.village,
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.incident_code,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.positive_incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      LEFT JOIN public.positive_incident_categories ic ON il.incident_category_id = ic.category_id
      WHERE il.user_id = $1
      ORDER BY il.created_at DESC;
    `;
    const result = await client.query(query, [user_id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'No positive incident logs found for this user', data: [] });
    }

    // Fetch images from MongoDB
    const incidentIds = result.rows.map((r) => r.incident_id);
    let imagesMap = {};
    if (incidentIds.length > 0) {
      const mongoImages = await MongoImage.find({
        sourceType: 'positive_incident',
        recordId: { $in: incidentIds },
      }).lean();
      imagesMap = mongoImages.reduce((acc, img) => {
        const rid = img.recordId;
        if (!acc[rid]) acc[rid] = [];
        acc[rid].push({
          image_id: img.imageId,
          image_category: img.imageCategory,
          image_type: img.imageType,
          image_data: img.imageData,
          note: img.note,
        });
        return acc;
      }, {});
    }

    const data = result.rows.map((row) => ({
      ...row,
      incident_image: imagesMap[row.incident_id] || [],
    }));

    res.json({ success: true, message: 'Positive incident logs fetched successfully', data });
  } catch (err) {
    console.error('[positive-incident-logs GET by user] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch positive incident logs' });
  }
});

// ─────────────────────────────────────────────────────────
// READ SINGLE — GET /api/positive-incident-logs/:incident_id
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-logs/:incident_id', verifyJwt, async (req, res) => {
  const { incident_id } = req.params;

  try {
    const query = `
      SELECT
        il.incident_id,
        il.user_id,
        il.incident_type,
        il.incident_category_id,
        ic.category_name,
        il.incident_subcategory,
        il.division,
        il.range_name,
        il.round,
        il.beat,
        il.village,
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.incident_code,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.positive_incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      LEFT JOIN public.positive_incident_categories ic ON il.incident_category_id = ic.category_id
      WHERE il.incident_id = $1;
    `;
    const result = await client.query(query, [incident_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Positive incident log not found' });
    }

    // Fetch image from MongoDB
    const mongoImages = await MongoImage.find({
      sourceType: 'positive_incident',
      recordId: Number(incident_id),
    }).lean();

    const data = {
      ...result.rows[0],
      incident_image: mongoImages.map((img) => ({
        image_id: img.imageId,
        image_category: img.imageCategory,
        image_type: img.imageType,
        image_data: img.imageData,
        note: img.note,
      })),
    };

    res.json({ success: true, message: 'Positive incident log fetched successfully', data });
  } catch (err) {
    console.error('[positive-incident-logs GET single] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch positive incident log' });
  }
});

// ─────────────────────────────────────────────────────────
// UPDATE — PUT /api/positive-incident-logs/:incident_id
// Body (multipart/form-data):
//   incident_type, incident_date, incident_time, description
//   file: incident_image (optional new image)
// ─────────────────────────────────────────────────────────
router.put('/positive-incident-logs/:incident_id', verifyJwt, upload.single('incident_image'), async (req, res) => {
  const { incident_id } = req.params;
  const { incident_type, incident_category_id, incident_subcategory, division, range_name, round, beat, village, incident_date, incident_time, description } = req.body;

  try {
    // Check if incident exists
    const checkQuery = 'SELECT incident_id FROM public.positive_incident_logs WHERE incident_id = $1';
    const checkResult = await client.query(checkQuery, [incident_id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Positive incident log not found' });
    }

    // File type validation
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type. Only JPG, PNG, GIF, HEIC images are allowed.',
        });
      }
    }

    const cleanType = incident_type ? clean(incident_type) : undefined;
    const cleanSubcategory = incident_subcategory !== undefined ? (incident_subcategory ? clean(incident_subcategory) : null) : undefined;
    const cleanDesc = description !== undefined ? (description ? clean(description) : null) : undefined;
    const categoryId = incident_category_id !== undefined ? (incident_category_id ? Number(incident_category_id) : null) : undefined;
    const cleanDivision = division !== undefined ? (division ? clean(division) : null) : undefined;
    const cleanRange = range_name !== undefined ? (range_name ? clean(range_name) : null) : undefined;
    const cleanRound = round !== undefined ? (round ? clean(round) : null) : undefined;
    const cleanBeat = beat !== undefined ? (beat ? clean(beat) : null) : undefined;
    const cleanVillage = village !== undefined ? (village ? clean(village) : null) : undefined;

    // Build dynamic UPDATE query
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (cleanType !== undefined) {
      setClauses.push(`incident_type = $${paramIndex++}`);
      params.push(cleanType);
    }
    if (categoryId !== undefined) {
      setClauses.push(`incident_category_id = $${paramIndex++}`);
      params.push(categoryId);
    }
    if (cleanSubcategory !== undefined) {
      setClauses.push(`incident_subcategory = $${paramIndex++}`);
      params.push(cleanSubcategory);
    }
    if (cleanDivision !== undefined) {
      setClauses.push(`division = $${paramIndex++}`);
      params.push(cleanDivision);
    }
    if (cleanRange !== undefined) {
      setClauses.push(`range_name = $${paramIndex++}`);
      params.push(cleanRange);
    }
    if (cleanRound !== undefined) {
      setClauses.push(`round = $${paramIndex++}`);
      params.push(cleanRound);
    }
    if (cleanBeat !== undefined) {
      setClauses.push(`beat = $${paramIndex++}`);
      params.push(cleanBeat);
    }
    if (cleanVillage !== undefined) {
      setClauses.push(`village = $${paramIndex++}`);
      params.push(cleanVillage);
    }
    if (incident_date !== undefined) {
      setClauses.push(`incident_date = $${paramIndex++}`);
      params.push(incident_date);
    }
    if (incident_time !== undefined) {
      setClauses.push(`incident_time = $${paramIndex++}`);
      params.push(incident_time);
    }
    if (cleanDesc !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(cleanDesc);
    }

    if (setClauses.length === 0 && !req.file) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(incident_id);

    const updateQuery = `
      UPDATE public.positive_incident_logs
      SET ${setClauses.join(', ')}
      WHERE incident_id = $${paramIndex}
      RETURNING incident_id, user_id, incident_type, incident_date::text AS incident_date, incident_time::text AS incident_time, description, incident_code, updated_at;
    `;
    const result = await client.query(updateQuery, params);

    // If new image uploaded, replace old image in MongoDB
    if (req.file) {
      // Delete old images for this incident
      await MongoImage.deleteMany({ sourceType: 'positive_incident', recordId: Number(incident_id) });

      // Insert new image
      const base64Image = req.file.buffer.toString('base64');
      const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
      const nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;

      await MongoImage.create({
        imageId: nextId,
        sourceType: 'positive_incident',
        recordId: Number(incident_id),
        imageCategory: 'incident_image',
        imageType: req.file.mimetype,
        imageData: base64Image,
        note: cleanDesc || null,
      });
    }

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_UPDATE',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'positive_incident_log',
      resourceId: incident_id,
      details: { incident_type: cleanType },
    });

    res.json({
      success: true,
      message: 'Positive incident log updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[positive-incident-logs PUT] Error:', err.message);

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_UPDATE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'positive_incident_log',
      resourceId: incident_id,
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to update positive incident log', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE — DELETE /api/positive-incident-logs/:incident_id
// Deletes the positive incident log from PostgreSQL and its
// image from MongoDB
// ─────────────────────────────────────────────────────────
router.delete('/positive-incident-logs/:incident_id', verifyJwt, async (req, res) => {
  const { incident_id } = req.params;

  try {
    // Check if incident exists
    const checkQuery = 'SELECT incident_id, user_id FROM public.positive_incident_logs WHERE incident_id = $1';
    const checkResult = await client.query(checkQuery, [incident_id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Positive incident log not found' });
    }

    const userId = checkResult.rows[0].user_id;

    // Delete from PostgreSQL
    await client.query('DELETE FROM public.positive_incident_logs WHERE incident_id = $1', [incident_id]);

    // Delete image from MongoDB
    await MongoImage.deleteMany({ sourceType: 'positive_incident', recordId: Number(incident_id) });

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_DELETE',
      status: 'SUCCESS',
      statusCode: 200,
      userId,
      resourceType: 'positive_incident_log',
      resourceId: incident_id,
    });

    res.json({ success: true, message: 'Positive incident log deleted successfully' });
  } catch (err) {
    console.error('[positive-incident-logs DELETE] Error:', err.message);

    logFromRequest(req, {
      action: 'POSITIVE_INCIDENT_DELETE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'positive_incident_log',
      resourceId: incident_id,
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to delete positive incident log' });
  }
});

module.exports = router;
module.exports.ensurePositiveIncidentLogsTable = ensurePositiveIncidentLogsTable;
