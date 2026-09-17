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
// Gujarati seed data — parallel to SEED_POSITIVE_CATEGORIES
// (from the Positive Incident Categories Gujarati document)
// ─────────────────────────────────────────────────────────
const SEED_POSITIVE_CATEGORIES_GU = [
  { name: 'વન્યજીવ જોવા મળવો', subcategories: [
    'વન્ય પ્રાણીઓ જોવા મળવા', 'પક્ષીઓ જોવા મળવા',
    'સરિસૃપો જોવા મળવા', 'મહત્વપૂર્ણ પ્રજાતિઓ જોવા મળવી',
  ]},
  { name: 'વન્યજીવના નિશાન જોવા મળવા', subcategories: [
    'વન્યજીવના પગના નિશાન જોવા / ઓળખવા મળવા', 'મળમૂત્ર જોવા મળવા',
    'માળા ઓળખવા મળવા', 'દર જોવા / ઓળખવા મળવા',
    'વૃક્ષની છાલ પરના ખંજવાળના નિશાન જોવા / ઓળખવા મળવા',
  ]},
  { name: 'કુદરતી પુનઃઉત્પાદનની સફળતા', subcategories: [
    'સારી કુદરતી પુનઃઉત્પાદન સ્થિતિ જોવા મળવી',
    'નવા રોપા / નાના છોડ જોવા અથવા ઓળખવા મળવા',
    'કાપકૂપ બાદ સારી નવી વૃદ્ધિ જોવા મળવી',
  ]},
  { name: 'વાવેતરની સફળતા', subcategories: [
    'સ્વસ્થ વાવેતર જોવા મળવું', 'રોપાઓનું સારું જીવંત રહેવું', 'નવું વાવેતર સફળ થવું',
  ]},
  { name: 'જંગલની સ્થિતિમાં સુધારો', subcategories: [
    'વનસ્પતિ આવરણમાં સુધારો', 'ગાઢ નીચલી વનસ્પતિ જોવા મળવી',
    'સ્વસ્થ જંગલનો વિસ્તાર જોવા મળવો',
  ]},
  { name: 'પાણીની ઉપલબ્ધતા', subcategories: [
    'તળાવોમાં પાણી ઉપલબ્ધ હોવું', 'નાળામાં પાણી ઉપલબ્ધ હોવું',
    'પાણીના કુંડમાં પાણી ઉપલબ્ધ હોવું', 'ચેકડેમમાં પાણી ઉપલબ્ધ હોવું',
    'અન્ય જળસ્ત્રોતોમાં પાણી ઉપલબ્ધ હોવું',
  ]},
  { name: 'જળ સંરક્ષણ કામગીરીની સફળતા', subcategories: [
    'ચેકડેમ કાર્યરત અને સારી સ્થિતિમાં હોવું', 'કન્ટૂર ટ્રેન્ચ કાર્યરત અને સારી સ્થિતિમાં હોવી',
    'જળસંગ્રહનું માળખું કાર્યરત અને સારી સ્થિતિમાં હોવું',
  ]},
  { name: 'આગ નિવારણ કામગીરી', subcategories: [
    'ફાયર લાઇનની યોગ્ય જાળવણી થયેલી હોવી', 'સૂકો જૈવિક કચરો દૂર કરેલો હોવો',
    'આગ નિવારણના પગલાં અમલમાં મૂકવામાં આવ્યા હોવા',
    'આગ નિવારણની કામગીરી પૂર્ણ થયેલી હોવી',
  ]},
  { name: 'જંગલની આગ સફળતાપૂર્વક કાબૂમાં લેવી', subcategories: [
    'જંગલની આગની વહેલી તકે જાણ થઈ અને સફળતાપૂર્વક ઓલવવામાં / કાબૂમાં લેવામાં આવી',
  ]},
  { name: 'સફળ વન સુરક્ષા કામગીરી', subcategories: [
    'પેટ્રોલિંગ દરમિયાન ગેરકાયદેસર પ્રવૃત્તિની જાણ થઈ / તેને અટકાવવામાં આવી',
  ]},
  { name: 'વન વ્યવસ્થાપન કામગીરી પૂર્ણ', subcategories: [
    'વાવેતરની કામગીરી પૂર્ણ થયેલી હોવી', 'વાડબંધીની કામગીરી પૂર્ણ થયેલી હોવી',
    'માટી-જળ સંરક્ષણની કામગીરી પૂર્ણ થયેલી હોવી',
    'જાળવણી કામગીરી પૂર્ણ થયેલી હોવી',
  ]},
  { name: 'સીમા / માળખાકીય સુવિધાઓ સારી સ્થિતિમાં', subcategories: [
    'સીમા નિશાનીનો થાંભલો સારી સ્થિતિમાં હોવો', 'વાડ સારી સ્થિતિમાં હોવી',
    'ગેટ સારી સ્થિતિમાં હોવા', 'વોચટાવર સારી સ્થિતિમાં હોવું',
    'પેટ્રોલિંગ માર્ગ સારી સ્થિતિમાં હોવો',
  ]},
  { name: 'દુર્લભ / લુપ્તપ્રાય મહત્વપૂર્ણ પ્રજાતિનું નિરીક્ષણ', subcategories: [
    'દુર્લભ, સંકટગ્રસ્ત, લુપ્તપ્રાય અથવા ઔષધીય / પર્યાવરણીય રીતે મહત્વપૂર્ણ વનસ્પતિ પ્રજાતિ નોંધાયેલી હોવી',
    'દુર્લભ / લુપ્તપ્રાય / સંકટગ્રસ્ત પ્રાણી પ્રજાતિ નોંધાયેલી હોવી',
  ]},
  { name: 'પુનઃસ્થાપન કામગીરીની સફળતા', subcategories: [
    'અગાઉ ક્ષતિગ્રસ્ત વિસ્તારની પુનઃપ્રાપ્તિ / પુનઃસ્થાપન જોવા મળવું',
  ]},
  { name: 'સ્વચ્છ વન વિસ્તાર', subcategories: [
    'કચરો / પ્લાસ્ટિક દૂર કરેલું હોવું', 'વિસ્તારમાં કચરો ફેંકાયેલો ન હોવો',
  ]},
  { name: 'સફળ પેટ્રોલિંગ કામગીરી', subcategories: [
    'અગાઉ સંવેદનશીલ / જોખમવાળા સ્થળની તપાસ કરી અને સુરક્ષિત જણાયું',
  ]},
  { name: 'અન્ય સકારાત્મક નિરીક્ષણ', subcategories: [
    'ઉપરોક્ત શ્રેણીઓમાં આવરી ન લેવાયેલો કોઈ લાભદાયક વિકાસ / સકારાત્મક બાબત',
  ]},
];

// Returns true when ?language= is set to Gujarati ('gu', 'gujarati', 'gu-IN', ...)
const wantsGujarati = (req) =>
  String(req.query.language || '').toLowerCase().startsWith('gu');

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

  // Gujarati name columns (added later — existing tables need the ALTER)
  await client.query(`
    ALTER TABLE public.positive_incident_categories
      ADD COLUMN IF NOT EXISTS category_name_gu VARCHAR(500);
  `);
  await client.query(`
    ALTER TABLE public.positive_incident_subcategories
      ADD COLUMN IF NOT EXISTS subcategory_name_gu VARCHAR(500);
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
      const catGu = SEED_POSITIVE_CATEGORIES_GU[i] || { name: null, subcategories: [] };
      const catResult = await client.query(
        'INSERT INTO public.positive_incident_categories (category_name, category_name_gu, display_order) VALUES ($1, $2, $3) RETURNING category_id',
        [cat.name, catGu.name, i + 1]
      );
      const categoryId = catResult.rows[0].category_id;

      for (let j = 0; j < cat.subcategories.length; j++) {
        await client.query(
          'INSERT INTO public.positive_incident_subcategories (category_id, subcategory_name, subcategory_name_gu, display_order) VALUES ($1, $2, $3, $4)',
          [categoryId, cat.subcategories[j], catGu.subcategories[j] || null, j + 1]
        );
      }
    }
    console.log(`[positive_incident_categories] Seeded ${SEED_POSITIVE_CATEGORIES.length} categories with subcategories.`);
  }

  // Backfill Gujarati names for rows seeded before the _gu columns existed
  const missingGu = await client.query(
    'SELECT COUNT(*)::int AS cnt FROM public.positive_incident_categories WHERE category_name_gu IS NULL'
  );
  if ((missingGu.rows[0]?.cnt || 0) > 0) {
    console.log('[positive_incident_categories] Backfilling Gujarati names...');
    for (let i = 0; i < SEED_POSITIVE_CATEGORIES.length; i++) {
      const cat = SEED_POSITIVE_CATEGORIES[i];
      const catGu = SEED_POSITIVE_CATEGORIES_GU[i];
      if (!catGu) continue;

      await client.query(
        `UPDATE public.positive_incident_categories SET category_name_gu = $1
         WHERE category_name = $2 AND category_name_gu IS NULL`,
        [catGu.name, cat.name]
      );

      for (let j = 0; j < cat.subcategories.length; j++) {
        const subGu = catGu.subcategories[j];
        if (!subGu) continue;
        await client.query(
          `UPDATE public.positive_incident_subcategories s SET subcategory_name_gu = $1
           FROM public.positive_incident_categories c
           WHERE s.category_id = c.category_id AND c.category_name = $2
             AND s.subcategory_name = $3 AND s.subcategory_name_gu IS NULL`,
          [subGu, cat.name, cat.subcategories[j]]
        );
      }
    }
    console.log('[positive_incident_categories] Gujarati names backfilled.');
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
  const gu = wantsGujarati(req);
  const catNameCol = gu ? 'COALESCE(category_name_gu, category_name)' : 'category_name';
  const subNameCol = gu ? 'COALESCE(subcategory_name_gu, subcategory_name)' : 'subcategory_name';
  try {
    const catResult = await client.query(`
      SELECT category_id, ${catNameCol} AS category_name, display_order
      FROM public.positive_incident_categories
      ORDER BY display_order ASC, category_id ASC;
    `);

    const subResult = await client.query(`
      SELECT subcategory_id, category_id, ${subNameCol} AS subcategory_name, display_order
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
  const catNameCol = wantsGujarati(req)
    ? 'COALESCE(category_name_gu, category_name)'
    : 'category_name';
  try {
    const result = await client.query(`
      SELECT category_id, ${catNameCol} AS category_name, display_order
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
  const gu = wantsGujarati(req);
  const catNameCol = gu ? 'COALESCE(category_name_gu, category_name)' : 'category_name';
  const subNameCol = gu ? 'COALESCE(subcategory_name_gu, subcategory_name)' : 'subcategory_name';

  try {
    // Verify category exists
    const catCheck = await client.query(
      `SELECT category_id, ${catNameCol} AS category_name FROM public.positive_incident_categories WHERE category_id = $1`,
      [category_id]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const result = await client.query(`
      SELECT subcategory_id, category_id, ${subNameCol} AS subcategory_name, display_order
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
  const { category_name, category_name_gu, subcategories } = req.body;

  if (!category_name) {
    return res.status(400).json({ success: false, error: 'category_name is required' });
  }

  try {
    const maxOrder = await client.query('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM public.positive_incident_categories');
    const nextOrder = (maxOrder.rows[0]?.max_order || 0) + 1;

    const result = await client.query(
      'INSERT INTO public.positive_incident_categories (category_name, category_name_gu, display_order) VALUES ($1, $2, $3) RETURNING category_id, category_name, category_name_gu, display_order',
      [category_name, category_name_gu || null, nextOrder]
    );

    const categoryId = result.rows[0].category_id;

    // Insert subcategories if provided
    if (Array.isArray(subcategories) && subcategories.length > 0) {
      for (let i = 0; i < subcategories.length; i++) {
        const name = typeof subcategories[i] === 'string' ? subcategories[i] : subcategories[i].subcategory_name;
        const nameGu = typeof subcategories[i] === 'object' ? subcategories[i].subcategory_name_gu : null;
        if (name) {
          await client.query(
            'INSERT INTO public.positive_incident_subcategories (category_id, subcategory_name, subcategory_name_gu, display_order) VALUES ($1, $2, $3, $4)',
            [categoryId, name, nameGu || null, i + 1]
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
  const { category_name, category_name_gu } = req.body;

  if (!category_name) {
    return res.status(400).json({ success: false, error: 'category_name is required' });
  }

  try {
    const result = await client.query(
      'UPDATE public.positive_incident_categories SET category_name = $1, category_name_gu = COALESCE($3, category_name_gu) WHERE category_id = $2 RETURNING category_id, category_name, category_name_gu, display_order',
      [category_name, category_id, category_name_gu || null]
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
