const express = require('express');
const { verifyJwt } = require('../middlewares/verifyJwt');
const { sequelize } = require('../config/database');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// Thin adapter (same as patrolRoutes / incidentLogs)
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
// Seed data from the Positive Incident Categories document
// ─────────────────────────────────────────────────────────
const SEED_POSITIVE_CATEGORIES = [
  { name: 'Wildlife Sighting', subcategories: [
    'Sighting of wild animals', 'Sighting of birds',
    'Sighting of reptiles', 'Sighting of important species',
  ]},
  { name: 'Wildlife Signs', subcategories: [
    'Pugmarks seen/identified', 'Excreta/droppings found',
    'Nests identified', 'Burrows identified',
    'Scratch marks on barks identified',
  ]},
  { name: 'Successful Natural Regeneration', subcategories: [
    'Good visible natural regeneration',
    'New seedlings/saplings identified/observed',
    'Good coppice growth',
  ]},
  { name: 'Plantation Success', subcategories: [
    'Healthy plantation', 'Good survival', 'Successful new planting',
  ]},
  { name: 'Improved Forest Condition', subcategories: [
    'Improved vegetation cover', 'Dense undergrowth',
    'Healthy forest patch observed',
  ]},
  { name: 'Water Availability', subcategories: [
    'Water available in ponds', 'Water available in streams',
    'Water available in waterholes', 'Water available in check dams',
    'Water available in other sources',
  ]},
  { name: 'Water Conservation Success', subcategories: [
    'Functional check dam', 'Functional contour trench',
    'Water harvesting structure in good working condition',
  ]},
  { name: 'Fire Prevention Activity', subcategories: [
    'Fire line maintained', 'Dry biomass cleared',
    'Fire prevention measures implemented',
    'Fire prevention measures completed',
  ]},
  { name: 'Fire Successfully Controlled', subcategories: [
    'Forest fire detected early and successfully extinguished/controlled',
  ]},
  { name: 'Successful Protection Action', subcategories: [
    'Illegal activity detected/prevented during patrol',
  ]},
  { name: 'Forest Management Work Completed', subcategories: [
    'Plantation work completed', 'Fencing work completed',
    'Soil-water conservation work completed',
    'Maintenance work completed',
  ]},
  { name: 'Boundary / Infrastructure in Good Condition', subcategories: [
    'Boundary pillar in good condition', 'Fencing in good condition',
    'Gates in good condition', 'Watchtower in good condition',
    'Patrol route found in good condition',
  ]},
  { name: 'Rare/Endangered Important Species Observation', subcategories: [
    'Rare/threatened/endangered/medicinal/ecologically important plant species recorded',
    'Rare/endangered/threatened animal species recorded',
  ]},
  { name: 'Restoration Success', subcategories: [
    'Previously degraded area showing recovery/restoration',
  ]},
  { name: 'Clean Forest Area', subcategories: [
    'Waste/plastic removed', 'Area observed free from dumping',
  ]},
  { name: 'Patrolling Achievement', subcategories: [
    'Previously vulnerable/sensitive location checked and found secure',
  ]},
  { name: 'Other Positive Observation', subcategories: [
    'Any beneficial development not covered by the above categories',
  ]},
];

// ─────────────────────────────────────────────────────────
// Auto-create tables and seed data when server starts
// ─────────────────────────────────────────────────────────
async function ensurePositiveIncidentCategoryTables() {
  // Create categories table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.positive_incident_categories (
      category_id   SERIAL PRIMARY KEY,
      category_name VARCHAR(255) NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create subcategories table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.positive_incident_subcategories (
      subcategory_id   SERIAL PRIMARY KEY,
      category_id      INTEGER NOT NULL REFERENCES public.positive_incident_categories(category_id) ON DELETE CASCADE,
      subcategory_name VARCHAR(255) NOT NULL,
      display_order    INTEGER DEFAULT 0,
      created_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE (category_id, subcategory_name)
    );
  `);

  // Indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_positive_incident_subcategories_category_id
    ON public.positive_incident_subcategories (category_id);
  `);

  // Seed data — only if the categories table is empty
  const countResult = await client.query('SELECT COUNT(*)::int AS cnt FROM public.positive_incident_categories');
  const existingCount = countResult.rows[0]?.cnt || 0;

  if (existingCount === 0) {
    console.log('[positive_incident_categories] Seeding initial data...');
    for (let i = 0; i < SEED_POSITIVE_CATEGORIES.length; i++) {
      const cat = SEED_POSITIVE_CATEGORIES[i];
      const catResult = await client.query(
        'INSERT INTO public.positive_incident_categories (category_name, display_order) VALUES ($1, $2) RETURNING category_id',
        [cat.name, i + 1]
      );
      const categoryId = catResult.rows[0].category_id;

      for (let j = 0; j < cat.subcategories.length; j++) {
        await client.query(
          'INSERT INTO public.positive_incident_subcategories (category_id, subcategory_name, display_order) VALUES ($1, $2, $3)',
          [categoryId, cat.subcategories[j], j + 1]
        );
      }
    }
    console.log(`[positive_incident_categories] Seeded ${SEED_POSITIVE_CATEGORIES.length} categories with subcategories.`);
  }
}

// Primary worker only — avoid every cluster worker racing the same DDL.
if (require('../utils/isPrimaryWorker')) {
  ensurePositiveIncidentCategoryTables().catch((err) => {
    console.error('Failed to ensure positive incident category tables:', err.message);
  });
}

// ─────────────────────────────────────────────────────────
// GET /api/positive-incident-categories
// Returns all positive categories with their subcategories (nested)
// Used for dropdowns and frontend display
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-categories', verifyJwt, async (req, res) => {
  try {
    const catResult = await client.query(`
      SELECT category_id, category_name, display_order
      FROM public.positive_incident_categories
      ORDER BY display_order ASC, category_id ASC;
    `);

    const subResult = await client.query(`
      SELECT subcategory_id, category_id, subcategory_name, display_order
      FROM public.positive_incident_subcategories
      ORDER BY display_order ASC, subcategory_id ASC;
    `);

    // Group subcategories by category_id
    const subMap = {};
    for (const sub of subResult.rows) {
      if (!subMap[sub.category_id]) subMap[sub.category_id] = [];
      subMap[sub.category_id].push({
        subcategory_id: sub.subcategory_id,
        subcategory_name: sub.subcategory_name,
        display_order: sub.display_order,
      });
    }

    const data = catResult.rows.map((cat) => ({
      category_id: cat.category_id,
      category_name: cat.category_name,
      display_order: cat.display_order,
      subcategories: subMap[cat.category_id] || [],
    }));

    res.json({ success: true, message: 'Positive incident categories fetched successfully', data });
  } catch (err) {
    console.error('[positive-incident-categories GET] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch positive incident categories' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/positive-incident-categories/flat
// Returns a flat list of categories only (for simple dropdown)
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-categories/flat', verifyJwt, async (req, res) => {
  try {
    const result = await client.query(`
      SELECT category_id, category_name, display_order
      FROM public.positive_incident_categories
      ORDER BY display_order ASC, category_id ASC;
    `);
    res.json({ success: true, message: 'Positive incident categories fetched successfully', data: result.rows });
  } catch (err) {
    console.error('[positive-incident-categories/flat GET] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch positive incident categories' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/positive-incident-categories/:category_id/subcategories
// Returns subcategories for a specific category (dependent dropdown)
// ─────────────────────────────────────────────────────────
router.get('/positive-incident-categories/:category_id/subcategories', verifyJwt, async (req, res) => {
  const { category_id } = req.params;

  try {
    // Verify category exists
    const catCheck = await client.query(
      'SELECT category_id, category_name FROM public.positive_incident_categories WHERE category_id = $1',
      [category_id]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const result = await client.query(`
      SELECT subcategory_id, category_id, subcategory_name, display_order
      FROM public.positive_incident_subcategories
      WHERE category_id = $1
      ORDER BY display_order ASC, subcategory_id ASC;
    `, [category_id]);

    res.json({
      success: true,
      message: 'Subcategories fetched successfully',
      category: catCheck.rows[0],
      data: result.rows,
    });
  } catch (err) {
    console.error('[positive-incident-categories subcategories GET] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch subcategories' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/positive-incident-categories
// Add a new category (admin)
// ─────────────────────────────────────────────────────────
router.post('/positive-incident-categories', verifyJwt, async (req, res) => {
  const { category_name, subcategories } = req.body;

  if (!category_name) {
    return res.status(400).json({ success: false, error: 'category_name is required' });
  }

  try {
    const maxOrder = await client.query('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM public.positive_incident_categories');
    const nextOrder = (maxOrder.rows[0]?.max_order || 0) + 1;

    const result = await client.query(
      'INSERT INTO public.positive_incident_categories (category_name, display_order) VALUES ($1, $2) RETURNING category_id, category_name, display_order',
      [category_name, nextOrder]
    );

    const categoryId = result.rows[0].category_id;

    // Insert subcategories if provided
    if (Array.isArray(subcategories) && subcategories.length > 0) {
      for (let i = 0; i < subcategories.length; i++) {
        const name = typeof subcategories[i] === 'string' ? subcategories[i] : subcategories[i].subcategory_name;
        if (name) {
          await client.query(
            'INSERT INTO public.positive_incident_subcategories (category_id, subcategory_name, display_order) VALUES ($1, $2, $3)',
            [categoryId, name, i + 1]
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[positive-incident-categories POST] Error:', err.message);
    if (err.message.includes('duplicate') || err.message.includes('unique')) {
      return res.status(409).json({ success: false, error: 'Category already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/positive-incident-categories/:category_id
// Update a category name (admin)
// ─────────────────────────────────────────────────────────
router.put('/positive-incident-categories/:category_id', verifyJwt, async (req, res) => {
  const { category_id } = req.params;
  const { category_name } = req.body;

  if (!category_name) {
    return res.status(400).json({ success: false, error: 'category_name is required' });
  }

  try {
    const result = await client.query(
      'UPDATE public.positive_incident_categories SET category_name = $1 WHERE category_id = $2 RETURNING category_id, category_name, display_order',
      [category_name, category_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    res.json({ success: true, message: 'Category updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error('[positive-incident-categories PUT] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/positive-incident-categories/:category_id
// Delete a category and its subcategories (cascade)
// ─────────────────────────────────────────────────────────
router.delete('/positive-incident-categories/:category_id', verifyJwt, async (req, res) => {
  const { category_id } = req.params;

  try {
    const result = await client.query(
      'DELETE FROM public.positive_incident_categories WHERE category_id = $1 RETURNING category_id',
      [category_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('[positive-incident-categories DELETE] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

module.exports = router;
module.exports.ensurePositiveIncidentCategoryTables = ensurePositiveIncidentCategoryTables;
