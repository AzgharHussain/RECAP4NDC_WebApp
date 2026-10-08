const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../config/database');

const villageName = process.argv[2] || 'FATEPUR';

(async () => {
  try {
    console.log(`\nSearching hierarchy for village: "${villageName}" in July & August 2026 tables...\n`);

    // Search July 2026 Aravalli
    try {
      const [julyRows] = await sequelize.query(`
        SELECT DISTINCT division, range, round, beat, village, COUNT(*)::int AS pixel_changes
        FROM public."2026-07-01_aravalli_coupe_NDVI_Change"
        WHERE village ILIKE :v
        GROUP BY division, range, round, beat, village
      `, { replacements: { v: `%${villageName}%` } });

      console.log('--- July 2026 (2026-07-01_aravalli_coupe_NDVI_Change) ---');
      if (julyRows.length) {
        console.table(julyRows);
      } else {
        console.log(`No records found for ${villageName} in July Aravalli table.`);
      }
    } catch (e) {
      console.warn('July query warning:', e.message);
    }

    // Search August 2026 Aravalli
    try {
      const [augRows] = await sequelize.query(`
        SELECT DISTINCT division, range, round, beat, village, COUNT(*)::int AS pixel_changes
        FROM public."2026-08-01_aravalli_coupe_NDVI_Change"
        WHERE village ILIKE :v
        GROUP BY division, range, round, beat, village
      `, { replacements: { v: `%${villageName}%` } });

      console.log('\n--- August 2026 (2026-08-01_aravalli_coupe_NDVI_Change) ---');
      if (augRows.length) {
        console.table(augRows);
      } else {
        console.log(`No records found for ${villageName} in August Aravalli table.`);
      }
    } catch (e) {
      console.warn('August query warning:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
