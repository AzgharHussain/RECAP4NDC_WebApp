/**
 * Ensures a NDVI change table has a `pixle_id` column.
 *
 * Some older / auto-generated NDVI tables were created without a `pixle_id`
 * column.  When the scheduler (or any other code path) tries to SELECT it,
 * Postgres throws `column "pixle_id" does not exist`.
 *
 * This helper:
 *   1. Checks whether `pixle_id` already exists on the table.
 *   2. If it does NOT exist:
 *        - Adds the column as a plain INTEGER (NOT a primary key — the caller
 *          can promote it to a PK later if needed, but it is not compulsory).
 *        - Populates every existing row with a unique, sequential value using
 *          `ROW_NUMBER() OVER ()` so each row gets a distinct id.
 *        - Creates a plain btree index for fast lookups.
 *   3. If the column already exists but contains NULLs for some rows, those
 *      rows are back-filled with unique values so the column is fully usable.
 *
 * Works with either a `pg.Pool` client or a Sequelize instance — pass the
 * appropriate `runner` (a `client.query` function or sequelize instance).
 */

/**
 * Sanitize a table name into a valid SQL identifier for index names.
 * Replaces every character that is not alphanumeric or underscore with `_`.
 * e.g. "2025-05-01_Banaskantha_RWD_WC_final_NDVI_Change" → "2025_05_01_Banaskantha_RWD_WC_final_NDVI_Change"
 */
function sanitizeIndexName(tableName) {
  return tableName.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * @param {import('pg').Pool | { query: Function }} client  pg.Pool or sequelize
 * @param {string} tableName  the NDVI change table name (unquoted)
 * @param {object} [opts]
 * @param {boolean} [opts.isSequelize=false]  true when `client` is a Sequelize instance
 * @returns {Promise<boolean>}  true if the column was added/back-filled, false if already present & complete
 */
async function ensurePixleIdColumn(client, tableName, opts = {}) {
  const { isSequelize = false } = opts;
  const idxName = `idx_${sanitizeIndexName(tableName)}_pixle_id`;

  // Helper to run a query and return rows uniformly across pg.Pool / sequelize.
  // Uses `replacements` (named :param) for Sequelize and `bind` ($1) for pg,
  // so each driver gets the parameter style it handles best.
  const run = async (sql, params = {}) => {
    if (isSequelize) {
      // Sequelize: use named replacements (:name) — avoids bind-validation issues.
      const [rows] = await client.query(sql, {
        replacements: params,
        type: 'SELECT',
      });
      return rows || [];
    }
    // pg.Pool: use positional bind parameters ($1, $2, …).
    const bind = Object.values(params);
    const res = await client.query(sql, bind);
    return res.rows || [];
  };

  // Helper to run a statement that returns no rows (DDL / DML).
  const exec = async (sql) => {
    if (isSequelize) {
      await client.query(sql);
    } else {
      await client.query(sql);
    }
  };

  // 1) Does the column already exist?
  //    Table names come from information_schema (DB-validated), so interpolation
  //    is safe here.  We still parameterise the literal column name.
  const colRows = await run(
    isSequelize
      ? `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = :tableName
            AND column_name = 'pixle_id'`
      : `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name  = $1
            AND column_name = 'pixle_id'`,
    { tableName }
  );

  const columnExists = colRows.length > 0;

  if (!columnExists) {
    // 2) Add the column (plain INTEGER, not a primary key) and populate it
    //    with unique sequential values for every existing row.
    await exec(
      `ALTER TABLE public."${tableName}"
         ADD COLUMN IF NOT EXISTS pixle_id INTEGER;`
    );

    // Back-fill unique values using ROW_NUMBER() over a stable ordering.
    // ctid guarantees a stable, unique per-row ordering even when no PK exists.
    await exec(
      `WITH ranked AS (
          SELECT ctid, ROW_NUMBER() OVER (ORDER BY ctid) AS rn
            FROM public."${tableName}"
       )
       UPDATE public."${tableName}" t
          SET pixle_id = ranked.rn
         FROM ranked
        WHERE t.ctid = ranked.ctid;`
    );

    // Create an index for fast lookups (not unique — caller can promote later).
    // Index name is sanitised so hyphens/special chars in table names don't
    // cause SQL syntax errors.
    try {
      await exec(
        `CREATE INDEX IF NOT EXISTS ${idxName}
           ON public."${tableName}" (pixle_id);`
      );
    } catch (idxErr) {
      // Index creation failure is non-fatal — the column still works.
      console.warn(`[ensurePixleId] index creation skipped for "${tableName}":`, idxErr.message);
    }

    console.log(`[ensurePixleId] added + populated pixle_id for "${tableName}"`);
    return true;
  }

  // 3) Column exists — back-fill any NULL values so every row has a unique id.
  const nullRows = await run(
    `SELECT COUNT(*)::int AS cnt
       FROM public."${tableName}"
      WHERE pixle_id IS NULL;`
  );
  const nullCount = (nullRows[0] && nullRows[0].cnt) || 0;

  if (nullCount > 0) {
    // Start new ids above the current max so we never collide.
    await exec(
      `WITH base AS (
          SELECT COALESCE(MAX(pixle_id), 0) AS mx
            FROM public."${tableName}"
       ),
       ranked AS (
          SELECT ctid,
                 (SELECT mx FROM base) + ROW_NUMBER() OVER (ORDER BY ctid) AS rn
            FROM public."${tableName}"
           WHERE pixle_id IS NULL
       )
       UPDATE public."${tableName}" t
          SET pixle_id = ranked.rn
         FROM ranked
        WHERE t.ctid = ranked.ctid;`
    );
    console.log(`[ensurePixleId] back-filled ${nullCount} NULL pixle_id rows in "${tableName}"`);
    return true;
  }

  return false;
}

module.exports = { ensurePixleIdColumn };
