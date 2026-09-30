/**
 * addIndexes.js — Safe PostgreSQL optimization bootstrap for RECAP4NDC.
 *
 * Runs on backend startup from index.js. This file applies only safe,
 * idempotent optimizations:
 *   - PostgreSQL extensions used by spatial/text indexes
 *   - indexes for patrol, user, notification, dropdown, and NDVI tables
 *   - materialized views for dashboard/dropdown-style read-heavy queries
 *   - a query_cache table for optional DB-side caching
 *   - a refresh function for materialized views
 *
 * Important: this intentionally does NOT partition existing production tables
 * automatically. Partitioning is a migration and should be done in a planned
 * maintenance window after backup/testing.
 */
const { sequelize } = require('../config/database');

async function query(sql, label) {
  try {
    await sequelize.query(sql);
    return true;
  } catch (err) {
    console.warn(`[db-opt] skipped ${label}: ${err.message}`);
    return false;
  }
}

async function scalar(sql, replacements = {}) {
  const rows = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });
  return rows && rows[0];
}

async function tableExists(tableName) {
  const row = await scalar(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = :tableName
     ) AS exists`,
    { tableName }
  );
  return row && row.exists === true;
}

async function columnExists(tableName, columnName) {
  const row = await scalar(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :tableName AND column_name = :columnName
     ) AS exists`,
    { tableName, columnName }
  );
  return row && row.exists === true;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function createExtensions() {
  const extensions = [
    ['postgis', 'PostGIS spatial indexes/functions'],
    ['pg_trgm', 'trigram text search indexes'],
    ['btree_gin', 'btree_gin mixed GIN support'],
  ];

  for (const [ext, label] of extensions) {
    await query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(ext)}`, `extension ${label}`);
  }
}

async function createIndexIfColumns(tableName, indexName, columns, sql) {
  if (!(await tableExists(tableName))) return false;
  for (const column of columns) {
    if (!(await columnExists(tableName, column))) return false;
  }
  return query(sql, `index ${indexName}`);
}

async function createCoreIndexes() {
  await createIndexIfColumns('patrols', 'idx_patrols_patrol_id', ['patrol_id'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_patrol_id ON public.patrols (patrol_id DESC)');
  await createIndexIfColumns('patrols', 'idx_patrols_start_time', ['start_time'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_start_time ON public.patrols (start_time DESC)');
  await createIndexIfColumns('patrols', 'idx_patrols_start_time_brin', ['start_time'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_start_time_brin ON public.patrols USING brin (start_time) WITH (pages_per_range = 128)');
  await createIndexIfColumns('patrols', 'idx_patrols_division', ['division'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_division ON public.patrols (division)');
  await createIndexIfColumns('patrols', 'idx_patrols_range', ['range'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_range ON public.patrols ("range")');
  await createIndexIfColumns('patrols', 'idx_patrols_beat', ['beat'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_beat ON public.patrols (beat)');
  await createIndexIfColumns('patrols', 'idx_patrols_round', ['round'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_round ON public.patrols (round)');
  await createIndexIfColumns('patrols', 'idx_patrols_officer_name', ['patrol_officer_name'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_officer_name ON public.patrols (patrol_officer_name)');
  await createIndexIfColumns('patrols', 'idx_patrols_officer_name_trgm', ['patrol_officer_name'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_officer_name_trgm ON public.patrols USING gin (patrol_officer_name gin_trgm_ops)');
  await createIndexIfColumns('patrols', 'idx_patrols_patrolling_type_id', ['patrolling_type_id'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_patrolling_type_id ON public.patrols (patrolling_type_id)');
  await createIndexIfColumns('patrols', 'idx_patrols_user_id', ['user_id'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_user_id ON public.patrols (user_id)');
  await createIndexIfColumns('patrols', 'idx_patrols_forest_id', ['forest_id'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_forest_id ON public.patrols (forest_id)');
  await createIndexIfColumns('patrols', 'idx_patrols_geom_gist', ['geom'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_geom_gist ON public.patrols USING gist (geom)');
  await createIndexIfColumns('patrols', 'idx_patrols_division_range_beat', ['division', 'range', 'beat'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_division_range_beat ON public.patrols (division, "range", beat)');
  await createIndexIfColumns('patrols', 'idx_patrols_user_id_start_time', ['user_id', 'start_time'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_user_id_start_time ON public.patrols (user_id, start_time DESC)');
  await createIndexIfColumns('patrols', 'idx_patrols_division_start_time', ['division', 'start_time'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_division_start_time ON public.patrols (division, start_time DESC)');
  await createIndexIfColumns('patrols', 'idx_patrols_covering', ['division', 'range', 'beat', 'start_time', 'patrol_officer_name', 'distance_kms'],
    'CREATE INDEX IF NOT EXISTS idx_patrols_covering ON public.patrols (division, "range", beat, start_time DESC) INCLUDE (patrol_officer_name, distance_kms)');

  await createIndexIfColumns('patrolling_types', 'idx_patrolling_types_type_id', ['type_id'],
    'CREATE INDEX IF NOT EXISTS idx_patrolling_types_type_id ON public.patrolling_types (type_id)');
  await createIndexIfColumns('government_department_users', 'idx_govt_dept_users_username', ['username'],
    'CREATE INDEX IF NOT EXISTS idx_govt_dept_users_username ON public.government_department_users (username)');
  await createIndexIfColumns('government_department_users', 'idx_govt_dept_users_user_id', ['user_id'],
    'CREATE INDEX IF NOT EXISTS idx_govt_dept_users_user_id ON public.government_department_users (user_id)');

  await createIndexIfColumns('ndvi_notification_log', 'idx_ndvi_notif_log_user_table_pixel', ['user_id', 'table_name', 'pixel_id'],
    'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_log_user_table_pixel ON public.ndvi_notification_log (user_id, table_name, pixel_id)');
  await createIndexIfColumns('ndvi_notification_log', 'idx_ndvi_notif_log_created_at', ['created_at'],
    'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_log_created_at ON public.ndvi_notification_log (created_at DESC)');
  await createIndexIfColumns('ndvi_notification_log', 'idx_ndvi_notif_log_sent_at', ['sent_at'],
    'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_log_sent_at ON public.ndvi_notification_log (sent_at DESC)');
  await createIndexIfColumns('ndvi_notification_users', 'idx_ndvi_notif_users_user_id', ['user_id'],
    'CREATE INDEX IF NOT EXISTS idx_ndvi_notif_users_user_id ON public.ndvi_notification_users (user_id)');

  await createIndexIfColumns('coupe_village_master', 'idx_coupe_village_master_coupe_name', ['coupe_name'],
    'CREATE INDEX IF NOT EXISTS idx_coupe_village_master_coupe_name ON public.coupe_village_master (coupe_name)');
  await createIndexIfColumns('coupe_all', 'idx_coupe_all_division_range_beat', ['division', 'range', 'beat'],
    'CREATE INDEX IF NOT EXISTS idx_coupe_all_division_range_beat ON public.coupe_all (division, "range", beat)');
  await createIndexIfColumns('beat_witheeee22', 'idx_beat_witheeee22_division_range_beat', ['division', 'range', 'beat'],
    'CREATE INDEX IF NOT EXISTS idx_beat_witheeee22_division_range_beat ON public.beat_witheeee22 (division, "range", beat)');
}

async function createNdviIndexes() {
  const tables = await sequelize.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename LIKE '%\\_coupe\\_NDVI\\_Change' ESCAPE '\\'`,
    { type: sequelize.QueryTypes.SELECT }
  );

  for (const { tablename } of tables) {
    const table = quoteIdent(tablename);
    const safeName = tablename.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    if (await columnExists(tablename, 'pixle_id')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_pixle_id ON public.${table} (pixle_id)`, `NDVI ${tablename} pixle_id`);
    }
    if (await columnExists(tablename, 'status')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_status ON public.${table} (status)`, `NDVI ${tablename} status`);
    }
    if (await columnExists(tablename, 'NDVI_change')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_ndvi_change ON public.${table} ("NDVI_change")`, `NDVI ${tablename} NDVI_change`);
    }
    if (await columnExists(tablename, 'range')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_range ON public.${table} ("range")`, `NDVI ${tablename} range`);
    }
    if (await columnExists(tablename, 'round')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_round ON public.${table} ("round")`, `NDVI ${tablename} round`);
    }
    if (await columnExists(tablename, 'beat')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_beat ON public.${table} (beat)`, `NDVI ${tablename} beat`);
    }
    if (await columnExists(tablename, 'geom')) {
      await query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_geom_gist ON public.${table} USING gist (geom)`, `NDVI ${tablename} geom`);
    }
  }
}

async function createQueryCacheTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.query_cache (
      cache_key TEXT PRIMARY KEY,
      cache_value JSONB NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `, 'query_cache table');

  await query('CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON public.query_cache (expires_at)', 'query_cache expires index');

  await query(`
    CREATE OR REPLACE FUNCTION public.cleanup_query_cache()
    RETURNS void AS $$
    BEGIN
      DELETE FROM public.query_cache WHERE expires_at < NOW();
    END;
    $$ LANGUAGE plpgsql;
  `, 'cleanup_query_cache function');
}

async function createMaterializedViews() {
  if (await tableExists('patrols')) {
    await query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_patrol_stats AS
      SELECT
        md5(
          COALESCE(DATE_TRUNC('day', start_time)::text, '') || '|' ||
          COALESCE(division, '') || '|' || COALESCE("range", '') || '|' || COALESCE(beat, '')
        ) AS mv_key,
        DATE_TRUNC('day', start_time) AS patrol_date,
        division,
        "range",
        beat,
        COUNT(*)::int AS total_patrols,
        COALESCE(SUM(distance_kms), 0)::double precision AS total_distance,
        COUNT(DISTINCT user_id)::int AS unique_officers,
        json_agg(DISTINCT patrolling_type_id) FILTER (WHERE patrolling_type_id IS NOT NULL) AS patrol_types
      FROM public.patrols
      WHERE start_time IS NOT NULL
        AND start_time > NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', start_time), division, "range", beat
      WITH DATA
    `, 'materialized view mv_patrol_stats');

    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_patrol_stats_key ON public.mv_patrol_stats (mv_key)', 'mv_patrol_stats unique index');

    await query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_patrol_hierarchy AS
      SELECT
        md5(COALESCE(division, '') || '|' || COALESCE("range", '') || '|' || COALESCE(beat, '')) AS mv_key,
        division,
        "range",
        beat,
        COUNT(*)::int AS patrol_count,
        MAX(start_time) AS last_patrol_time
      FROM public.patrols
      WHERE division IS NOT NULL OR "range" IS NOT NULL OR beat IS NOT NULL
      GROUP BY division, "range", beat
      WITH DATA
    `, 'materialized view mv_patrol_hierarchy');

    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_patrol_hierarchy_key ON public.mv_patrol_hierarchy (mv_key)', 'mv_patrol_hierarchy unique index');
  }

  await query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ndvi_change_tables AS
    SELECT
      tablename,
      substring(tablename from '^\\d{4}-\\d{2}-\\d{2}')::date AS table_date,
      regexp_replace(tablename, '^\\d{4}-\\d{2}-\\d{2}_', '') AS coupe_table_name
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE '%\\_coupe\\_NDVI\\_Change' ESCAPE '\\'
    WITH DATA
  `, 'materialized view mv_ndvi_change_tables');

  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ndvi_change_tables_name ON public.mv_ndvi_change_tables (tablename)', 'mv_ndvi_change_tables unique index');

  await query(`
    CREATE OR REPLACE FUNCTION public.refresh_recap4ndc_materialized_views()
    RETURNS void AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_patrol_stats') THEN
        REFRESH MATERIALIZED VIEW public.mv_patrol_stats;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_patrol_hierarchy') THEN
        REFRESH MATERIALIZED VIEW public.mv_patrol_hierarchy;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_ndvi_change_tables') THEN
        REFRESH MATERIALIZED VIEW public.mv_ndvi_change_tables;
      END IF;
      PERFORM public.cleanup_query_cache();
    END;
    $$ LANGUAGE plpgsql;
  `, 'refresh_recap4ndc_materialized_views function');
}

async function refreshMaterializedViews() {
  // Issue REFRESH directly instead of `SELECT public.refresh_recap4ndc_materialized_views()`.
  // A SELECT wrapping a volatile function can be routed to a read-only replica by
  // read/write-splitting proxies (e.g. pgpool), failing with "cannot execute
  // REFRESH MATERIALIZED VIEW in a read-only transaction". Utility statements
  // route to the primary. CONCURRENTLY is used because each MV has a unique
  // index, so readers aren't blocked; fall back to a plain refresh if it fails.
  const views = ['mv_patrol_stats', 'mv_patrol_hierarchy', 'mv_ndvi_change_tables'];
  for (const view of views) {
    const exists = await scalar(
      `SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = :view`,
      { view }
    );
    if (!exists) continue;
    const concurrent = await query(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY public.${quoteIdent(view)}`,
      `refresh ${view} (concurrent)`
    );
    if (!concurrent) {
      await query(`REFRESH MATERIALIZED VIEW public.${quoteIdent(view)}`, `refresh ${view}`);
    }
  }
  // Run the delete directly rather than SELECT-ing the plpgsql function —
  // a SELECT can be routed to a read-only replica by splitting proxies.
  await query('DELETE FROM public.query_cache WHERE expires_at < NOW()', 'cleanup query cache');
}

async function analyzeTables() {
  const tables = ['patrols', 'patrolling_types', 'government_department_users', 'ndvi_notification_log', 'ndvi_notification_users', 'coupe_all', 'beat_witheeee22'];
  for (const tableName of tables) {
    if (await tableExists(tableName)) {
      await query(`ANALYZE public.${quoteIdent(tableName)}`, `ANALYZE ${tableName}`);
    }
  }
}

async function addIndexes() {
  console.log('[db-opt] Starting PostgreSQL startup optimizations...');
  await createExtensions();
  await createCoreIndexes();
  await createNdviIndexes();
  await createQueryCacheTable();
  await createMaterializedViews();
  await refreshMaterializedViews();
  await analyzeTables();
  console.log('[db-opt] PostgreSQL startup optimizations completed.');
}

module.exports = addIndexes;
