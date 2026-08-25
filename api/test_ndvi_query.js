require('dotenv').config();
const { sequelize } = require('./config/database');

(async () => {
  try {
    // Test the exact query the API uses (with the original join condition)
    const [r1] = await sequelize.query(`
      SELECT
        l.id, l.user_id, l.table_name, l.pixel_id, l.sent_at,
        u.village_name, u.division, g.username
      FROM public.ndvi_notification_log l
      LEFT JOIN public.ndvi_notification_users u ON u.user_id = l.user_id
      LEFT JOIN public.government_department_users g ON g.user_id::text = l.user_id
      ORDER BY l.sent_at DESC NULLS LAST, l.id DESC
      LIMIT 10
    `);
    console.log('API join result (first 10):', r1.length, 'rows');
    console.log(JSON.stringify(r1, null, 2));

    // Check the user_id types in both tables
    const [r2] = await sequelize.query(`
      SELECT
        a.attname AS column_name,
        t.typname AS data_type
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_type t ON a.atttypid = t.oid
      WHERE c.relname = 'ndvi_notification_users'
        AND a.attname IN ('user_id')
    `);
    console.log('\nndvi_notification_users.user_id type:', JSON.stringify(r2));

    const [r3] = await sequelize.query(`
      SELECT
        a.attname AS column_name,
        t.typname AS data_type
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_type t ON a.atttypid = t.oid
      WHERE c.relname = 'ndvi_notification_log'
        AND a.attname IN ('user_id')
    `);
    console.log('\nndvi_notification_log.user_id type:', JSON.stringify(r3));

    // Check how many users match
    const [r4] = await sequelize.query(`
      SELECT COUNT(*) as matched
      FROM public.ndvi_notification_log l
      JOIN public.ndvi_notification_users u ON u.user_id::text = l.user_id
    `);
    console.log('\nMatched rows (with cast):', r4[0].matched);

    const [r5] = await sequelize.query(`
      SELECT COUNT(*) as matched
      FROM public.ndvi_notification_log l
      JOIN public.ndvi_notification_users u ON u.user_id = l.user_id
    `);
    console.log('Matched rows (no cast):', r5[0].matched);

    // Check ndvi_notification_users sample
    const [r6] = await sequelize.query(`
      SELECT user_id FROM public.ndvi_notification_users LIMIT 5
    `);
    console.log('\nndvi_notification_users sample user_ids:', JSON.stringify(r6));

    const [r7] = await sequelize.query(`
      SELECT DISTINCT user_id FROM public.ndvi_notification_log LIMIT 5
    `);
    console.log('ndvi_notification_log sample user_ids:', JSON.stringify(r7));

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
