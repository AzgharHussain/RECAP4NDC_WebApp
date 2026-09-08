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
// Auto-create incident_logs table when this module loads
// (i.e. when the server starts and requires this router)
// ─────────────────────────────────────────────────────────
async function ensureIncidentLogsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.incident_logs (
      incident_id   SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      incident_type VARCHAR(255) NOT NULL,
      incident_date DATE NOT NULL,
      incident_time TIME NOT NULL,
      description   TEXT,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index for fast lookup by user_id
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_incident_logs_user_id
    ON public.incident_logs (user_id);
  `);
}

ensureIncidentLogsTable().catch((err) => {
  console.error('Failed to ensure incident_logs table:', err.message);
});

// ─────────────────────────────────────────────────────────
// Helper: format timestamp to IST
// ─────────────────────────────────────────────────────────
function formatIncidentTimestamp(dateValue, timeValue) {
  if (!dateValue) return null;
  let dateStr = dateValue;
  if (dateValue instanceof Date) {
    dateStr = dateValue.toISOString().split('T')[0];
  }
  if (timeValue) {
    return `${dateStr} ${timeValue}`;
  }
  return dateStr;
}

// ─────────────────────────────────────────────────────────
// CREATE — POST /api/incident-logs
// Body (multipart/form-data):
//   user_id, incident_type, incident_date, incident_time, description
//   file: incident_image (single image)
// ─────────────────────────────────────────────────────────
router.post('/incident-logs', verifyJwt, upload.single('incident_image'), async (req, res) => {
  const { user_id, incident_type, incident_date, incident_time, description } = req.body;

  // Validate required fields
  if (!user_id || !incident_type || !incident_date || !incident_time) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: user_id, incident_type, incident_date, incident_time',
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
      'SELECT user_id FROM public.government_department_users WHERE user_id = $1',
      [user_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Sanitize text fields
    const cleanType = clean(incident_type);
    const cleanDesc = description ? clean(description) : null;

    // Insert into PostgreSQL
    const insertQuery = `
      INSERT INTO public.incident_logs (user_id, incident_type, incident_date, incident_time, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING incident_id, user_id, incident_type, incident_date, incident_time, description, created_at;
    `;
    const result = await client.query(insertQuery, [
      user_id,
      cleanType,
      incident_date,
      incident_time,
      cleanDesc,
    ]);

    const incident_id = result.rows[0].incident_id;

    // Store image in MongoDB if uploaded
    if (req.file) {
      const base64Image = req.file.buffer.toString('base64');
      const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
      const nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;

      await MongoImage.create({
        imageId: nextId,
        sourceType: 'incident',
        recordId: incident_id,
        imageCategory: 'incident_image',
        imageType: req.file.mimetype,
        imageData: base64Image,
        note: cleanDesc,
      });
    }

    logFromRequest(req, {
      action: 'INCIDENT_CREATE',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user_id,
      resourceType: 'incident_log',
      resourceId: incident_id,
      details: { incident_type: cleanType, incident_date },
    });

    res.status(201).json({
      success: true,
      message: 'Incident log created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[incident-logs POST] Error:', err.message);

    logFromRequest(req, {
      action: 'INCIDENT_CREATE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      resourceType: 'incident_log',
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to create incident log', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// READ ALL — GET /api/incident-logs
// Returns all incident logs with their images from MongoDB
// ─────────────────────────────────────────────────────────
router.get('/incident-logs', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT
        il.incident_id,
        il.user_id,
        il.incident_type,
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      ORDER BY il.created_at DESC;
    `;
    const result = await client.query(query);

    // Fetch images from MongoDB for all incidents
    const incidentIds = result.rows.map((r) => r.incident_id);
    let imagesMap = {};
    if (incidentIds.length > 0) {
      const mongoImages = await MongoImage.find({
        sourceType: 'incident',
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

    res.json({ success: true, message: 'Incident logs fetched successfully', data });
  } catch (err) {
    console.error('[incident-logs GET all] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch incident logs' });
  }
});

// ─────────────────────────────────────────────────────────
// READ BY USER ID — GET /api/incident-logs/user/:user_id
// Returns all incident logs for a specific user with images
// ─────────────────────────────────────────────────────────
router.get('/incident-logs/user/:user_id', verifyJwt, async (req, res) => {
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
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      WHERE il.user_id = $1
      ORDER BY il.created_at DESC;
    `;
    const result = await client.query(query, [user_id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'No incident logs found for this user', data: [] });
    }

    // Fetch images from MongoDB
    const incidentIds = result.rows.map((r) => r.incident_id);
    let imagesMap = {};
    if (incidentIds.length > 0) {
      const mongoImages = await MongoImage.find({
        sourceType: 'incident',
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

    res.json({ success: true, message: 'Incident logs fetched successfully', data });
  } catch (err) {
    console.error('[incident-logs GET by user] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch incident logs' });
  }
});

// ─────────────────────────────────────────────────────────
// READ SINGLE — GET /api/incident-logs/:incident_id
// ─────────────────────────────────────────────────────────
router.get('/incident-logs/:incident_id', verifyJwt, async (req, res) => {
  const { incident_id } = req.params;

  try {
    const query = `
      SELECT
        il.incident_id,
        il.user_id,
        il.incident_type,
        il.incident_date::text AS incident_date,
        il.incident_time::text AS incident_time,
        il.description,
        il.created_at,
        il.updated_at,
        gdu.username
      FROM public.incident_logs il
      LEFT JOIN public.government_department_users gdu ON il.user_id = gdu.user_id
      WHERE il.incident_id = $1;
    `;
    const result = await client.query(query, [incident_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Incident log not found' });
    }

    // Fetch image from MongoDB
    const mongoImages = await MongoImage.find({
      sourceType: 'incident',
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

    res.json({ success: true, message: 'Incident log fetched successfully', data });
  } catch (err) {
    console.error('[incident-logs GET single] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch incident log' });
  }
});

// ─────────────────────────────────────────────────────────
// UPDATE — PUT /api/incident-logs/:incident_id
// Body (multipart/form-data):
//   incident_type, incident_date, incident_time, description
//   file: incident_image (optional new image)
// ─────────────────────────────────────────────────────────
router.put('/incident-logs/:incident_id', verifyJwt, upload.single('incident_image'), async (req, res) => {
  const { incident_id } = req.params;
  const { incident_type, incident_date, incident_time, description } = req.body;

  try {
    // Check if incident exists
    const checkQuery = 'SELECT incident_id FROM public.incident_logs WHERE incident_id = $1';
    const checkResult = await client.query(checkQuery, [incident_id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Incident log not found' });
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
    const cleanDesc = description !== undefined ? (description ? clean(description) : null) : undefined;

    // Build dynamic UPDATE query
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (cleanType !== undefined) {
      setClauses.push(`incident_type = $${paramIndex++}`);
      params.push(cleanType);
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
      UPDATE public.incident_logs
      SET ${setClauses.join(', ')}
      WHERE incident_id = $${paramIndex}
      RETURNING incident_id, user_id, incident_type, incident_date::text AS incident_date, incident_time::text AS incident_time, description, updated_at;
    `;
    const result = await client.query(updateQuery, params);

    // If new image uploaded, replace old image in MongoDB
    if (req.file) {
      // Delete old images for this incident
      await MongoImage.deleteMany({ sourceType: 'incident', recordId: Number(incident_id) });

      // Insert new image
      const base64Image = req.file.buffer.toString('base64');
      const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
      const nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;

      await MongoImage.create({
        imageId: nextId,
        sourceType: 'incident',
        recordId: Number(incident_id),
        imageCategory: 'incident_image',
        imageType: req.file.mimetype,
        imageData: base64Image,
        note: cleanDesc || null,
      });
    }

    logFromRequest(req, {
      action: 'INCIDENT_UPDATE',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'incident_log',
      resourceId: incident_id,
      details: { incident_type: cleanType },
    });

    res.json({
      success: true,
      message: 'Incident log updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[incident-logs PUT] Error:', err.message);

    logFromRequest(req, {
      action: 'INCIDENT_UPDATE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'incident_log',
      resourceId: incident_id,
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to update incident log', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE — DELETE /api/incident-logs/:incident_id
// Deletes the incident log from PostgreSQL and its image from MongoDB
// ─────────────────────────────────────────────────────────
router.delete('/incident-logs/:incident_id', verifyJwt, async (req, res) => {
  const { incident_id } = req.params;

  try {
    // Check if incident exists
    const checkQuery = 'SELECT incident_id, user_id FROM public.incident_logs WHERE incident_id = $1';
    const checkResult = await client.query(checkQuery, [incident_id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Incident log not found' });
    }

    const userId = checkResult.rows[0].user_id;

    // Delete from PostgreSQL
    await client.query('DELETE FROM public.incident_logs WHERE incident_id = $1', [incident_id]);

    // Delete image from MongoDB
    await MongoImage.deleteMany({ sourceType: 'incident', recordId: Number(incident_id) });

    logFromRequest(req, {
      action: 'INCIDENT_DELETE',
      status: 'SUCCESS',
      statusCode: 200,
      userId,
      resourceType: 'incident_log',
      resourceId: incident_id,
    });

    res.json({ success: true, message: 'Incident log deleted successfully' });
  } catch (err) {
    console.error('[incident-logs DELETE] Error:', err.message);

    logFromRequest(req, {
      action: 'INCIDENT_DELETE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'incident_log',
      resourceId: incident_id,
      errorMessage: err.message,
    });

    res.status(500).json({ success: false, error: 'Failed to delete incident log' });
  }
});

module.exports = router;
