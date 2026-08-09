/**
 * addIndexes.js — Creates database indexes on startup to speed up common queries.
 *
 * Called once on server boot. Uses CREATE INDEX IF NOT EXISTS so it's safe
 * to run multiple times. These indexes target the most common filter columns
 * used in patrol queries, which were causing 40-60 second query times.
 *
 * Indexes are created asynchronously — the server doesn't wait for them.
 */
const { sequelize } = require('../config/database');

const INDEXES = [
  // Patrols table — most queried columns
  'CREATE INDEX IF NOT EXISTS idx_patrols_patrol_id ON public.patrols (patrol_id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_start_time ON public.patrols (start_time DESC)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_division ON public.patrols (division)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_range ON public.patrols ("range")',
  'CREATE INDEX IF NOT EXISTS idx_patrols_beat ON public.patrols (beat)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_round ON public.patrols (round)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_officer_name ON public.patrols (patrol_officer_name)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_patrolling_type_id ON public.patrols (patrolling_type_id)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_user_id ON public.patrols (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_patrols_forest_id ON public.patrols (forest_id)',

  // Composite index for the most common filter combination
  'CREATE INDEX IF NOT EXISTS idx_patrols_division_range_beat ON public.patrols (division, "range", beat)',

  // Patrolling types
  'CREATE INDEX IF NOT EXISTS idx_patrolling_types_type_id ON public.patrolling_types (type_id)',

  // Government department users
  'CREATE INDEX IF NOT EXISTS idx_govt_dept_users_username ON public.government_department_users (username)',

  // Notification tables
  'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_log_user_table_pixel ON public.ndvi_notification_log (user_id, table_name, pixel_id)',
  'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_users_user_id ON public.ndvi_notification_users (user_id)',
];

async function addIndexes() {
  let created = 0;
  let skipped = 0;

  for (const sql of INDEXES) {
    try {
      await sequelize.query(sql);
      created++;
    } catch (err) {
      // Index might already exist or table might not exist yet — skip silently
      skipped++;
    }
  }

}

module.exports = addIndexes;
