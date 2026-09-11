const express = require('express');
const { verifyJwt } = require('../middlewares/verifyJwt');
const { sequelize } = require('../config/database');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// Thin adapter (same as incidentCategories / incidentLogs)
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

// ─────────────────────────────────────────────────────────
// Seed data for severity levels
// ─────────────────────────────────────────────────────────
const SEED_SEVERITY_LEVELS = [
  { level_name: 'Critical', display_order: 1, color_code: '#dc2626' },
  { level_name: 'High', display_order: 2, color_code: '#ea580c' },
  { level_name: 'Medium', display_order: 3, color_code: '#ca8a04' },
  { level_name: 'Low', display_order: 4, color_code: '#16a34a' },
];

// ─────────────────────────────────────────────────────────
// Ensure table exists and seed if empty
// ─────────────────────────────────────────────────────────
async function ensureIncidentSeverityTables() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.incident_severity_levels (
      severity_id    SERIAL PRIMARY KEY,
      level_name     VARCHAR(50) UNIQUE NOT NULL,
      display_order  INTEGER,
      color_code     VARCHAR(20),
      created_at     TIMESTAMP DEFAULT NOW()
    );
  `);

  // Check if table is empty
  const countResult = await client.query(
    'SELECT COUNT(*)::int AS cnt FROM public.incident_severity_levels'
  );
  const existingCount = countResult.rows[0]?.cnt || 0;

  if (existingCount === 0) {
    console.log('[incident_severity_levels] Seeding initial data...');
    for (const level of SEED_SEVERITY_LEVELS) {
      await client.query(
        'INSERT INTO public.incident_severity_levels (level_name, display_order, color_code) VALUES ($1, $2, $3)',
        [level.level_name, level.display_order, level.color_code]
      );
    }
    console.log(`[incident_severity_levels] Seeded ${SEED_SEVERITY_LEVELS.length} severity levels.`);
  }
}

// Run on module load — primary worker only, so cluster workers don't race.
if (require('../utils/isPrimaryWorker')) {
  ensureIncidentSeverityTables().catch((err) => {
    console.error('Failed to ensure incident_severity_levels table:', err.message);
  });
}

// ─────────────────────────────────────────────────────────
// GET /api/incident-severity
// Returns all severity levels ordered by display_order
// ─────────────────────────────────────────────────────────
router.get('/incident-severity', verifyJwt, async (req, res) => {
  try {
    const result = await client.query(`
      SELECT severity_id, level_name, display_order, color_code
      FROM public.incident_severity_levels
      ORDER BY display_order ASC, severity_id ASC;
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[incident-severity GET] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch severity levels' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/incident-severity
// Create a new severity level
// ─────────────────────────────────────────────────────────
router.post('/incident-severity', verifyJwt, async (req, res) => {
  const { level_name, display_order, color_code } = req.body;
  if (!level_name) {
    return res.status(400).json({ success: false, error: 'level_name is required' });
  }
  try {
    const result = await client.query(
      'INSERT INTO public.incident_severity_levels (level_name, display_order, color_code) VALUES ($1, $2, $3) RETURNING *',
      [level_name, display_order || null, color_code || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[incident-severity POST] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create severity level' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/incident-severity/:severity_id
// Update a severity level
// ─────────────────────────────────────────────────────────
router.put('/incident-severity/:severity_id', verifyJwt, async (req, res) => {
  const { severity_id } = req.params;
  const { level_name, display_order, color_code } = req.body;
  try {
    const setClauses = [];
    const params = [];
    let idx = 1;
    if (level_name !== undefined) { setClauses.push(`level_name = $${idx++}`); params.push(level_name); }
    if (display_order !== undefined) { setClauses.push(`display_order = $${idx++}`); params.push(display_order); }
    if (color_code !== undefined) { setClauses.push(`color_code = $${idx++}`); params.push(color_code); }
    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    setClauses.push(`updated_at = NOW()`);
    params.push(severity_id);
    const result = await client.query(
      `UPDATE public.incident_severity_levels SET ${setClauses.join(', ')} WHERE severity_id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Severity level not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[incident-severity PUT] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update severity level' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/incident-severity/:severity_id
// Delete a severity level
// ─────────────────────────────────────────────────────────
router.delete('/incident-severity/:severity_id', verifyJwt, async (req, res) => {
  const { severity_id } = req.params;
  try {
    const result = await client.query(
      'DELETE FROM public.incident_severity_levels WHERE severity_id = $1 RETURNING severity_id',
      [severity_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Severity level not found' });
    }
    res.json({ success: true, message: 'Severity level deleted successfully' });
  } catch (err) {
    console.error('[incident-severity DELETE] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete severity level' });
  }
});

module.exports = router;
module.exports.ensureIncidentSeverityTables = ensureIncidentSeverityTables;
