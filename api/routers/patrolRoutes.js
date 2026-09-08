const express = require('express');
const multer = require('multer');
const jwt = require("jsonwebtoken");
const { verifyJwt } = require("../middlewares/verifyJwt");
const { clean } = require("../middlewares/sanitize");
const MongoImage = require("../models/Image");
const { logFromRequest } = require("../utils/auditLogger");
const { sequelize } = require("../config/r_quire");

const router = express.Router();

// ─────────────────────────────────────────────────────────
// Use a thin adapter that delegates to Sequelize so ALL queries share the
// ONE connection pool (database.js). Replacing the old separate pg.Pool which
// was creating a second pool that timed out in production (ETIMEDOUT).
// Supports:
//   client.query(sql, params)         → { rows: [...] }
//   client.connect()                  → pseudo-client for transactions
// ─────────────────────────────────────────────────────────
const client = {
  query: async (sql, params) => {
    // Support both plain SQL string and pg-style config object { text, values, timeout }
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
      // Replace undefined with null — Sequelize's bind throws on undefined values
      const safeParams = (Array.isArray(params) ? params : [params]).map(v => v === undefined ? null : v);
      options.bind = safeParams;
    }
    // Retry on ConnectionAcquireTimeoutError — the pool is momentarily
    // exhausted (e.g. during a scheduler burst).  Wait briefly and retry
    // instead of failing the API request immediately.
    const MAX_ACQUIRE_RETRIES = 2;
    let lastErr;
    for (let attempt = 0; attempt <= MAX_ACQUIRE_RETRIES; attempt++) {
      try {
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
      } catch (err) {
        lastErr = err;
        const isAcquireTimeout =
          err.name === 'SequelizeConnectionAcquireTimeoutError' ||
          err.message?.includes('Operation timeout') ||
          err.message?.includes('ConnectionAcquireTimeoutError');
        if (!isAcquireTimeout || attempt === MAX_ACQUIRE_RETRIES) throw err;
        // Brief backoff before retrying — 500ms, then 1000ms
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastErr;
  },

  // Transaction support — mimics pg.Pool.connect()
  // Returns an object with query() and release() methods.
  // BEGIN/COMMIT/ROLLBACK are intercepted to manage the Sequelize transaction.
  connect: async () => {
    const t = await sequelize.transaction();
    let isDone = false;

    const txClient = {
      query: async (sql, params) => {
        // Support both plain SQL string and pg-style config object { text, values, timeout }
        if (sql && typeof sql === 'object' && !Array.isArray(sql)) {
          params = sql.values || params;
          sql = sql.text;
        }
        const trimmed = sql.trim().toUpperCase();

        // Intercept transaction control commands
        if (trimmed === 'BEGIN') return { rows: [] };
        if (trimmed === 'COMMIT') {
          if (!isDone) { await t.commit(); isDone = true; }
          return { rows: [] };
        }
        if (trimmed === 'ROLLBACK') {
          if (!isDone) { await t.rollback(); isDone = true; }
          return { rows: [] };
        }

        // Regular query within the transaction
        let queryType;
        if (/^SELECT/.test(trimmed)) queryType = sequelize.QueryTypes.SELECT;
        else if (/^INSERT/.test(trimmed)) queryType = sequelize.QueryTypes.INSERT;
        else if (/^UPDATE/.test(trimmed)) queryType = sequelize.QueryTypes.UPDATE;
        else if (/^DELETE/.test(trimmed)) queryType = sequelize.QueryTypes.DELETE;
        else if (/^ALTER/.test(trimmed)) queryType = sequelize.QueryTypes.RAW;
        else queryType = sequelize.QueryTypes.RAW;

        const options = { raw: true, type: queryType, transaction: t };
        if (params) {
          // Replace undefined with null — Sequelize's bind throws on undefined values
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
      release: () => {
        // If transaction wasn't committed or rolled back, roll it back
        if (!isDone) {
          t.rollback().catch(() => {});
          isDone = true;
        }
      },
    };
    return txClient;
  },
};

// Multer memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});


function formatPatrolTimestamp(dateValue) {
  if (!dateValue) return null;

  // If it's already a Date object, use it directly
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    // PostgreSQL text format: "2026-07-30 22:20:29.532+00" or ISO "2026-07-30T22:20:29.532Z"
    // Normalize: replace space with 'T' for ISO parsing if needed
    let normalized = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T');
    }
    date = new Date(normalized);
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) return null;

  // Convert to IST (Asia/Kolkata) and format as DD-MM-YYYY HH:mm
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
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue.toISOString();
  if (typeof dateValue === 'string') {
    // Try to normalize common formats like "2025-01-15 08:00:00" to ISO
    const normalized = dateValue
      .replace(' ', 'T')
      .replace(/(\d{2}):(\d{2}):(\d{2})$/, '$1:$2:$3+00:00');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeImageNotes(body = {}) {
  const parseList = (value) => {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        return trimmed.includes('|||') ? trimmed.split('|||') : [trimmed];
      }
    }
    return [value];
  };

  const candidates = [
    ...parseList(body.image_notes),
    ...parseList(body.imageNotes),
    ...parseList(body.notes),
    ...parseList(body.note),
  ];

  return candidates.map((item) => {
    if (item && typeof item === 'object') return clean(item.note ?? item.notes ?? item.value ?? '');
    return clean(item);
  });
}

function getImageNote(body, file, index, notes) {
  const fieldNote = body[`${file.fieldname}_note`] ?? body[`${file.fieldname}Note`] ?? body[`note_${index}`] ?? body[`image_note_${index}`] ?? body[`imageNotes[${index}]`] ?? body[`image_notes[${index}]`];
  const note = fieldNote !== undefined ? fieldNote : notes[index];
  const cleaned = clean(note);
  return cleaned || null;
}

async function ensurePatrolLocationColumns(dbClient = client) {
  await dbClient.query(`
    ALTER TABLE public.patrols
      ADD COLUMN IF NOT EXISTS patrolling_location TEXT,
      ADD COLUMN IF NOT EXISTS current_location_distict TEXT,
      ADD COLUMN IF NOT EXISTS current_location_village TEXT,
      ADD COLUMN IF NOT EXISTS patrol_code VARCHAR(100) UNIQUE;
  `);
  // Index for fast lookup by patrol_code
  await dbClient.query(`
    CREATE INDEX IF NOT EXISTS idx_patrols_patrol_code
    ON public.patrols (patrol_code);
  `);
}

ensurePatrolLocationColumns().catch((err) => {
  console.error('Failed to ensure patrol location columns:', err.message);
});

// ─────────────────────────────────────────────────────────
// Generate a human-readable patrol_code:
//   PAT-<DIVISION>-<USERNAME>-<YYYYMMDD>-<HHMM>-<PATROL_ID>
// Division and username are sanitized to keep the code URL-safe.
// patrol_id is appended to guarantee uniqueness when the same user
// starts two patrols in the same division within the same minute.
// ─────────────────────────────────────────────────────────
function sanitizeCodePart(value, maxLen = 15) {
  if (!value) return 'unknown';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, maxLen) || 'unknown';
}

function generatePatrolCode(division, username, startISO, patrolId) {
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const div = sanitizeCodePart(division, 5).toUpperCase();
  const usr = sanitizeCodePart(username, 15);
  return `PAT-${div}-${usr}-${date}-${time}-${patrolId}`;
}

// POST route for patrol with multiple images and optional notes
router.post('/patrol-post', verifyJwt, upload.any(), async (req, res) => {
  const pat_data = req.body;
  const imageNotes = normalizeImageNotes(pat_data);

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
    // First check if user exists in government_department_users and fetch username
    const userCheckQuery = `
      SELECT user_id, username FROM government_department_users 
      WHERE user_id = $1
    `;
    
    const userCheck = await client.query(userCheckQuery, [pat_data.user_id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in government department users' });
    }

    const username = userCheck.rows[0].username;

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

      // Generate and persist a human-readable patrol_code
      // Format: PAT-<DIVISION>-<USERNAME>-<YYYYMMDD>-<HHMM>-<PATROL_ID>
      const patrol_code = generatePatrolCode(
        pat_data.division,
        username,
        startUTC,
        patrol_id
      );
      if (patrol_code) {
        await txClient.query(
          'UPDATE patrols SET patrol_code = $1 WHERE patrol_id = $2',
          [patrol_code, patrol_id]
        );
      }

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
          const note = getImageNote(pat_data, file, i, imageNotes);

          return {
            imageId: nextId++,
            sourceType: 'patrol',
            patrolId: patrol_id,
            imageCategory,
            imageType: file.mimetype,
            imageData: base64Image,
            note,
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

      res.json({ message: 'Data created successfully', patrol_id, patrol_code });

    } catch (err) {
      // Rollback transaction on error
      await txClient.query('ROLLBACK');
      throw err;
    } finally {
      txClient.release();
    }

  } catch (err) {
    console.error('[patrol-post] Error:', err);
    console.error('[patrol-post] Error stack:', err.stack);
    console.error('[patrol-post] Request body:', {
      user_id: pat_data.user_id,
      patrol_officer_name: pat_data.patrol_officer_name,
      start_time: pat_data.start_time,
      end_time: pat_data.end_time,
      startUTC,
      endUTC,
      beat: pat_data.beat,
      range: pat_data.range,
      division: pat_data.division,
      distance_kms: pat_data.distance_kms,
    });

    logFromRequest(req, {
      action: 'RECORD_CREATE',
      status: 'ERROR',
      statusCode: 500,
      userId: req.body?.user_id || null,
      resourceType: 'patrol',
      errorMessage: err.message,
    });
    res.status(500).json({ error: 'Data insertion failed', details: err.message });
  }
});


router.get('/patrol-info-all', verifyJwt, async (req, res) => {
  try {
    // NOTE: dedupe patrolling_types via subquery to prevent row multiplication
    const query = `
      SELECT
        p.*,
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt
        ON p.patrolling_type_id = pt.type_id
      ORDER BY p.start_time DESC NULLS LAST, p.patrol_id DESC;
    `;

    const result = await client.query({ text: query, timeout: 30000 });

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),
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
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt ON p.patrolling_type_id = pt.type_id
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
          note: img.note || null,
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

  start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
  end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),

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
      forest_id,
      patrolling_location
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

    if (patrolling_location) {
      conditions.push(`p.patrolling_location ILIKE $${paramIndex}`);
      values.push(patrolling_location);
      paramIndex++;
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Main query with pagination and filters (no image JOIN)
    // NOTE: patrolling_types may have duplicate type_id rows, which would
    // multiply patrol rows via a plain LEFT JOIN. We dedupe via a subquery
    // so each patrol appears exactly once.
    const query = `
      SELECT
        p.*,
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt
        ON p.patrolling_type_id = pt.type_id
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
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt
        ON p.patrolling_type_id = pt.type_id
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
          note: img.note || null,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),
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
      forest_id,
      patrolling_location
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

    if (patrolling_location) {
      whereConditions.push(`p.patrolling_location ILIKE $${paramIndex}`);
      queryParams.push(patrolling_location);
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
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      ORDER BY p.start_time DESC NULLS LAST
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    // -----------------------------
    // COUNT QUERY
    // -----------------------------

    const countQuery = `
      SELECT COUNT(DISTINCT p.patrol_id) AS total_count
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt ON p.patrolling_type_id = pt.type_id
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
          note: img.note || null,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),
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

// Updated /patrol-info-user/:user_id endpoint with pagination
router.get('/patrol-info-user/:user_id', verifyJwt, async (req, res) => {
  try {
    const { user_id } = req.params;

    // Pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Optional filters (same set supported by /patrol-info-page)
    const {
      officer_name,
      start_date,
      end_date,
      type_name,
      division,
      range,
      round,
      beat,
      forest_id,
      patrolling_location
    } = req.query;

    // Build WHERE clause dynamically: always filter by user_id, plus any optional filters
    const conditions = [`p.user_id = $1`];
    const values = [user_id];
    let paramIndex = 2;

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

    if (officer_name) {
      conditions.push(`p.patrol_officer_name ILIKE $${paramIndex}`);
      values.push(`%${officer_name}%`);
      paramIndex++;
    }

    if (start_date) {
      conditions.push(`p.start_time >= $${paramIndex}`);
      values.push(start_date);
      paramIndex++;
    }

    if (end_date) {
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

    if (patrolling_location) {
      conditions.push(`p.patrolling_location ILIKE $${paramIndex}`);
      values.push(patrolling_location);
      paramIndex++;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // Main query with pagination
    // NOTE: dedupe patrolling_types via subquery to prevent row multiplication
    const query = `
      SELECT
        p.*,
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt
        ON p.patrolling_type_id = pt.type_id
      ${whereClause}
      ORDER BY p.start_time DESC NULLS LAST, p.patrol_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    values.push(limit, offset);

    // Count query for total records with same filters
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt
        ON p.patrolling_type_id = pt.type_id
      ${whereClause};
    `;

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
          note: img.note || null,
        });
        return acc;
      }, {});
    }

    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),
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

router.get('/patrols/:patrol_id', verifyJwt, async (req, res) => {
  const { patrol_id } = req.params;

  try {
    const query = `
      SELECT
        p.*,
        pt.type_name,
        p.start_time::text AS start_time_raw,
        p.end_time::text AS end_time_raw
      FROM patrols p
      LEFT JOIN (SELECT DISTINCT type_id, type_name FROM patrolling_types) pt ON p.patrolling_type_id = pt.type_id
      WHERE p.patrol_id = $1;
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
      note: img.note || null,
    }));

    const formattedPatrol = {
      ...patrol,
      start_time: formatPatrolTimestamp(patrol.start_time_raw || patrol.start_time),
      end_time: formatPatrolTimestamp(patrol.end_time_raw || patrol.end_time),
      images
    };

    res.json({ message: 'Patrol fetched successfully', data: formattedPatrol });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrol' });
  }
});

router.put('/patrol-images/:image_id/note', verifyJwt, async (req, res) => {
  try {
    const imageId = parseInt(req.params.image_id, 10);
    if (!Number.isInteger(imageId)) return res.status(400).json({ error: 'Invalid image_id' });

    const note = clean(req.body?.note ?? req.body?.notes ?? '');
    const updatedImage = await MongoImage.findOneAndUpdate(
      { sourceType: 'patrol', imageId },
      { $set: { note: note || null } },
      { new: true }
    ).lean();

    if (!updatedImage) return res.status(404).json({ error: 'Patrol image not found' });

    res.json({
      message: 'Patrol image note updated successfully',
      data: {
        image_id: updatedImage.imageId,
        patrol_id: updatedImage.patrolId,
        image_category: updatedImage.imageCategory,
        note: updatedImage.note || null,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update patrol image note' });
  }
});

router.delete('/patrol-images/:image_id/note', verifyJwt, async (req, res) => {
  try {
    const imageId = parseInt(req.params.image_id, 10);
    if (!Number.isInteger(imageId)) return res.status(400).json({ error: 'Invalid image_id' });

    const updatedImage = await MongoImage.findOneAndUpdate(
      { sourceType: 'patrol', imageId },
      { $set: { note: null } },
      { new: true }
    ).lean();

    if (!updatedImage) return res.status(404).json({ error: 'Patrol image not found' });

    res.json({
      message: 'Patrol image note deleted successfully',
      data: {
        image_id: updatedImage.imageId,
        patrol_id: updatedImage.patrolId,
        image_category: updatedImage.imageCategory,
        note: null,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete patrol image note' });
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
      FROM patrols
      WHERE division IS NOT NULL
        AND TRIM(division) != ''
        AND UPPER(TRIM(division)) NOT IN ('N/A', 'NA', 'NULL', 'NONE', '-')
      ORDER BY division;
    `;
    const result = await client.query(query);

    // Deduplicate: merge entries that are the same after removing
    // "Forest Division" suffix (e.g. "Bhavnagar" and "Bhavnagar Forest Division")
    const seen = new Map();
    result.rows.forEach(row => {
      const name = (row.division || '').trim();
      if (!name) return;
      // Normalize: remove "Forest Division" suffix for comparison
      const normalized = name.replace(/\s*Forest\s*Division\s*$/i, '').trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.set(normalized, name);
      }
    });

    const divisions = [...seen.values()].sort();
    res.json({
      message: 'All patrolling division fetched successfully',
      data: divisions.map(d => ({ division: d }))
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