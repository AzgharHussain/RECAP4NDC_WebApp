const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'api', '.env') });

const ee = require('@google/earthengine');
const { Client } = require('pg');
const { execFileSync } = require('child_process');
const https = require('https');

// ── Retry / network resilience ────────────────────────────────────────────────
const MAX_RETRIES = Number(process.env.EE_MAX_RETRIES || 5);
const INITIAL_BACKOFF_MS = Number(process.env.EE_INITIAL_BACKOFF_MS || 5000);
const BACKOFF_MULTIPLIER = Number(process.env.EE_BACKOFF_MULTIPLIER || 2);

// ── Proxy support ─────────────────────────────────────────────────────────────
// The @google/earthengine client makes its own HTTPS requests and does NOT
// respect https.globalAgent. We use global-agent which patches Node's HTTP/HTTPS
// stack at the lowest level so ALL outbound connections go through the proxy.
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
if (PROXY_URL) {
  try {
    process.env.GLOBAL_AGENT_HTTP_PROXY = PROXY_URL;
    process.env.GLOBAL_AGENT_HTTPS_PROXY = PROXY_URL;
    process.env.GLOBAL_AGENT_NO_PROXY = process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1';
    const globalAgent = require('global-agent');
    globalAgent.bootstrap();
    // eslint-disable-next-line no-console
    console.log(`[INFO] Using proxy (global-agent): ${PROXY_URL}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] Proxy setup failed (global-agent): ${err.message}. Falling back to https.globalAgent.`);
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      https.globalAgent = new HttpsProxyAgent(PROXY_URL);
      // eslint-disable-next-line no-console
      console.log(`[INFO] Using proxy (fallback https.globalAgent): ${PROXY_URL}`);
    } catch (err2) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] Fallback proxy setup also failed: ${err2.message}`);
    }
  }
}

function isTransientError(error) {
  const msg = String(error && (error.message || error)).toLowerCase();
  return msg.includes('etimedout') ||
         msg.includes('econnreset') ||
         msg.includes('econnrefused') ||
         msg.includes('enotfound') ||
         msg.includes('eai_again') ||
         msg.includes('socket hang up') ||
         msg.includes('invalid json') ||
         msg.includes('aggregateerror') ||
         msg.includes('timeout') ||
         msg.includes('429') ||
         msg.includes('503') ||
         msg.includes('502') ||
         msg.includes('500');
}

async function retryWithBackoff(fn, label, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isTransient = isTransientError(error);
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      const delay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
      log(`[${label}] Attempt ${attempt}/${maxRetries} failed (${error.message || error}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Database ──────────────────────────────────────────────────────────────────
const DB_NAME = 'recap4ndc';
const DB_USER = 'recap4ndc_postgres';
const DB_PASS = 'Reb@$hyd@08052026';
const DB_HOST = 'gsdc-psql.gujarat.gov.in';
const DB_PORT = 9999;
const DB_SSL = false;
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000);

function createDbClient() {
  return new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS,
    ssl: DB_SSL ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' } : false,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    keepAlive: true,
    keepAliveInitialDelayMillis: 30000,
  });
}

async function validateDbConnection() {
  const db = createDbClient();
  try {
    await db.connect();
    await db.query('SELECT 1');
    log(`Database connection OK: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  } catch (error) {
    throw new Error(`Database connection failed to ${DB_HOST}:${DB_PORT}/${DB_NAME}: ${error.message || error}`);
  } finally {
    await db.end().catch(() => {});
  }
}

// ── Earth Engine service-account key ─────────────────────────────────────────
// Prefer an explicit env var; otherwise auto-detect any giz-gujarat-*.json
// key file in this directory so key rotation doesn't require a code change.
function resolveServiceAccountKey() {
  if (process.env.EE_SERVICE_ACCOUNT_KEY) return process.env.EE_SERVICE_ACCOUNT_KEY;
  const candidates = fs.readdirSync(__dirname)
    .filter(f => /^giz-gujarat-.*\.json$/.test(f))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`No Earth Engine service account key found. Set EE_SERVICE_ACCOUNT_KEY or place a giz-gujarat-*.json file in ${__dirname}`);
  }
  if (candidates.length > 1) {
    console.warn(`[WARN] Multiple EE key files found (${candidates.join(', ')}); using ${candidates[candidates.length - 1]}. Remove old keys to avoid ambiguity.`);
  }
  return path.join(__dirname, candidates[candidates.length - 1]);
}
const SERVICE_ACCOUNT_KEY = resolveServiceAccountKey();

// ── Computation parameters ────────────────────────────────────────────────────
const SCALE            = Number(process.env.SCALE            || 10);
const CHANGE_THRESHOLD = Number(process.env.CHANGE_THRESHOLD || 0.3);

// ── GeoServer ─────────────────────────────────────────────────────────────────
const GEOSERVER_URL             = process.env.GEOSERVER_URL;
const GEOSERVER_USER            = process.env.GEOSERVER_USER;
const GEOSERVER_PASSWORD        = process.env.GEOSERVER_PASSWORD;
const GEOSERVER_WORKSPACE       = process.env.GEOSERVER_WORKSPACE       || 'Recap4NDC';
const GEOSERVER_STORE           = process.env.GEOSERVER_STORE           || 'Recap4NDC_Query';
const GEOSERVER_STYLE_WORKSPACE = process.env.GEOSERVER_STYLE_WORKSPACE || 'Recap4NDC_New';
const GEOSERVER_STYLE           = process.env.GEOSERVER_STYLE           || 'NDVI_CHANGE_NEW2222';

const TASK_NAME = 'Recap NDVI Monthly Coupe Computation';

const COUPES = [
  'aravalli_coupe',
  'banaskantha_coupe',
  'baria_coupe',
  'bharuchsubdivision_coupe',
  'bhavnagar_coupe',
  'chhotaudepur_coupe',
  'gandhinagar_coupe',
  'godhara_coupe',
  'jamnagar_coupe',
  'junagadh_coupe',
  'morbi_coupe',
  'narmada_coupe',
  'sabarkantha_coupe',
  'surat_coupe',
  'surendranagar_coupe',
  'vyara_coupe',
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const logsDir = path.join(__dirname, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function resolveMonth() {
  const monthArg = process.argv.find((arg) => /^--month=\d{4}-\d{2}$/.test(arg));
  if (monthArg) {
    const [year, month] = monthArg.split('=')[1].split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

const runMonth = resolveMonth();
const prevMonth = addMonths(runMonth, -1);
const nextMonth = addMonths(runMonth, 1);
const MONTH = {
  label: MONTH_LABELS[runMonth.getMonth()],
  prevLabel: MONTH_LABELS[prevMonth.getMonth()],
  runDate: dateString(runMonth),
  endDate: dateString(nextMonth),
  prevStart: dateString(prevMonth),
  prevEnd: dateString(runMonth),
};

const CURRENT_NDVI_COLUMN = `${MONTH.label}_NDVI`;
const PREV_NDVI_COLUMN = `${MONTH.prevLabel}_NDVI`;
const runId = `${MONTH.runDate}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
const logFile = path.join(logsDir, `ndvi_${runId}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(`${line}\n`);
}

function writeRaw(data) {
  process.stdout.write(data);
  logStream.write(data);
}

function ensureMonthlySchedule() {
  if (process.platform !== 'win32' || process.argv.includes('--no-schedule')) {
    return;
  }

  try {
    execFileSync('schtasks.exe', ['/Query', '/TN', TASK_NAME], { stdio: 'ignore' });
    log(`Scheduled task already exists: ${TASK_NAME}`);
    return;
  } catch (_) {}

  const taskRun = `"${process.execPath}" "${__filename}" --no-schedule`;
  try {
    execFileSync('schtasks.exe', [
      '/Create',
      '/TN',
      TASK_NAME,
      '/TR',
      taskRun,
      '/SC',
      'MONTHLY',
      '/D',
      '6',
      '/ST',
      '00:30',
      '/F',
    ], { stdio: 'ignore' });
    log(`Scheduled task created: ${TASK_NAME}`);
    log('Schedule: every month on day 6 at 12:30 AM');
  } catch (error) {
    log(`WARN: Could not create scheduled task automatically: ${error.message}`);
  }
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function q(value) {
  return encodeURIComponent(value);
}

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function geoserverRequest(method, requestPath, body) {
  const url = new URL(`${GEOSERVER_URL}${requestPath}`);
  const data = body ? JSON.stringify(body) : null;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASSWORD}`).toString('base64')}`,
    Accept: 'application/json',
  };
  if (data) headers['Content-Type'] = 'application/json';

  return new Promise((resolve, reject) => {
    const request = https.request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers,
      rejectUnauthorized: false,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${method} ${url.href} failed: HTTP ${response.statusCode}: ${raw}`));
          return;
        }
        resolve(raw ? JSON.parse(raw) : null);
      });
    });
    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

async function listFeaturetypes() {
  const payload = await geoserverRequest('GET', `/rest/workspaces/${q(GEOSERVER_WORKSPACE)}/datastores/${q(GEOSERVER_STORE)}/featuretypes.json`);
  return asList(payload.featureTypes && payload.featureTypes.featureType).map((item) => item.name).filter(Boolean);
}

async function listAvailableFeaturetypes() {
  const payload = await geoserverRequest('GET', `/rest/workspaces/${q(GEOSERVER_WORKSPACE)}/datastores/${q(GEOSERVER_STORE)}/featuretypes/available.json`);
  return asList(payload.list && payload.list.featureTypeName).filter(Boolean);
}

async function getAttributeNames(featuretype) {
  const payload = await geoserverRequest('GET', `/rest/workspaces/${q(GEOSERVER_WORKSPACE)}/datastores/${q(GEOSERVER_STORE)}/featuretypes/${q(featuretype)}.json`);
  return new Set(asList(payload.featureType && payload.featureType.attributes && payload.featureType.attributes.attribute).map((item) => item.name).filter(Boolean));
}

async function publishFeaturetype(featuretype) {
  await geoserverRequest('POST', `/rest/workspaces/${q(GEOSERVER_WORKSPACE)}/datastores/${q(GEOSERVER_STORE)}/featuretypes.json`, {
    featureType: { name: featuretype, nativeName: featuretype, title: featuretype },
  });
}

async function styleExists() {
  await geoserverRequest('GET', `/rest/workspaces/${q(GEOSERVER_STYLE_WORKSPACE)}/styles/${q(GEOSERVER_STYLE)}.json`);
}

async function setDefaultStyle(layerName) {
  await geoserverRequest('PUT', `/rest/layers/${q(`${GEOSERVER_WORKSPACE}:${layerName}`)}.json`, {
    layer: {
      defaultStyle: {
        name: GEOSERVER_STYLE,
        workspace: GEOSERVER_STYLE_WORKSPACE,
      },
    },
  });
}

function initializeEarthEngine() {
  const key = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY, 'utf8'));
  return retryWithBackoff(() => {
    return new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        key,
        () => ee.initialize(null, null, resolve, reject),
        reject
      );
    });
  }, 'EE init');
}

function evaluate(serverObject, label = 'evaluate') {
  return retryWithBackoff(() => {
    return new Promise((resolve, reject) => {
      serverObject.evaluate((result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }, label);
}

function maskS2Clouds(image) {
  const qa = image.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start']);
}

function ndviComposite(startDate, endDate, geometry) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
    .map(maskS2Clouds)
    .median()
    .normalizedDifference(['B8', 'B4']);
}

function changeCategory(value) {
  if (value < -CHANGE_THRESHOLD) return 'Degradation';
  return 'no_significant_change';
}

async function fetchSourceRows(db, sourceTable) {
  const result = await db.query(`
    SELECT id, geom, village, range, round, beat, division, coupe_no
    FROM public.${sourceTable}
    WHERE geom IS NOT NULL
    ORDER BY id
  `);
  return result.rows;
}

async function ensureTargetTable(db, targetTable) {
  await db.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS public."${targetTable}" (
      id bigserial PRIMARY KEY,
      geom geometry(Point, 4326),
      "NDVI_change" double precision,
      change_category text,
      latitude double precision,
      longitude double precision,
      division text,
      range text,
      round text,
      beat text,
      village text,
      ${quoteIdentifier(PREV_NDVI_COLUMN)} double precision,
      ${quoteIdentifier(CURRENT_NDVI_COLUMN)} double precision,
      pixle_id text,
      note text,
      image_data jsonb,
      status text,
      updated_at timestamp without time zone DEFAULT now(),
      created_at timestamp without time zone DEFAULT now(),
      coupe_no text
    )
  `);
}

async function clearTargetTable(db, targetTable) {
  await db.query(`TRUNCATE TABLE public."${targetTable}"`);
}

async function insertPixel(db, sourceTable, targetTable, row, feature) {
  const properties = feature.properties || {};
  const coordinates = feature.geometry && feature.geometry.coordinates;
  if (!coordinates || coordinates.length < 2) return;

  const lon = coordinates[0];
  const lat = coordinates[1];
  const currentNdvi = Number(properties[CURRENT_NDVI_COLUMN]);
  const prevNdvi = Number(properties[PREV_NDVI_COLUMN]);
  const ndviChange = Number(properties.NDVI_change);

  if (!Number.isFinite(ndviChange) || ndviChange >= -CHANGE_THRESHOLD) return;

  const pixelId = `${targetTable}_${row.id}_${lat.toFixed(6)}_${lon.toFixed(6)}`;
  const imageData = {
    source_table: sourceTable,
    source_id: row.id,
    current_start: MONTH.runDate,
    current_end: MONTH.endDate,
    previous_start: MONTH.prevStart,
    previous_end: MONTH.prevEnd,
    scale: SCALE,
  };

  await db.query(
    `INSERT INTO public."${targetTable}" (
      geom, "NDVI_change", change_category, latitude, longitude, division, range, round, beat,
      village, ${quoteIdentifier(PREV_NDVI_COLUMN)}, ${quoteIdentifier(CURRENT_NDVI_COLUMN)}, pixle_id, note, image_data, status, coupe_no
    ) VALUES (
      ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $2, $1, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15, $16
    )`,
    [
      lon,
      lat,
      ndviChange,
      changeCategory(ndviChange),
      row.division,
      row.range,
      row.round,
      row.beat,
      row.village,
      prevNdvi,
      currentNdvi,
      pixelId,
      null,
      JSON.stringify(imageData),
      'computed',
      row.coupe_no,
    ]
  );
}

async function processRow(db, sourceTable, targetTable, row, index, total) {
  const geomResult = await db.query(
    `SELECT ST_AsGeoJSON(ST_Force2D(ST_Transform(geom, 4326))) AS geojson FROM public.${sourceTable} WHERE id = $1`,
    [row.id]
  );
  const geojson = JSON.parse(geomResult.rows[0].geojson);
  const geometry = ee.Geometry(geojson);

  const currentNdvi = ndviComposite(MONTH.runDate, MONTH.endDate, geometry).rename(CURRENT_NDVI_COLUMN);
  const prevNdvi = ndviComposite(MONTH.prevStart, MONTH.prevEnd, geometry).rename(PREV_NDVI_COLUMN);
  const change = currentNdvi.subtract(prevNdvi).rename('NDVI_change');
  const image = currentNdvi.addBands(prevNdvi).addBands(change).clip(geometry);

  const samples = image
    .sample({
      region: geometry,
      scale: SCALE,
      geometries: true,
      tileScale: 4,
    })
    .filter(ee.Filter.lt('NDVI_change', -CHANGE_THRESHOLD));

  const collection = await evaluate(samples, `${sourceTable} id=${row.id}`);
  const features = collection.features || [];
  log(`[${index}/${total}] ${row.id} ${row.village || ''}: ${features.length} changed pixels`);

  for (const feature of features) {
    await insertPixel(db, sourceTable, targetTable, row, feature);
  }
}

async function processCoupe(sourceTable) {
  const targetTable = `${MONTH.runDate}_${sourceTable}_NDVI_Change`;
  const db = createDbClient();

  await db.connect();
  try {
    await ensureTargetTable(db, targetTable);
    await clearTargetTable(db, targetTable);
    const rows = await fetchSourceRows(db, sourceTable);
    log(`Processing ${rows.length} ${sourceTable} geometries at ${SCALE}m scale`);
    log(`Target table: public."${targetTable}"`);

    for (let i = 0; i < rows.length; i += 1) {
      try {
        await processRow(db, sourceTable, targetTable, rows[i], i + 1, rows.length);
      } catch (error) {
        log(`ERROR processing ${sourceTable} source id ${rows[i].id}: ${error.message || error}`);
      }
    }

    log(`Done. Results inserted into public."${targetTable}"`);
  } finally {
    await db.end();
  }
}

async function runPostprocessSql() {
  const db = createDbClient();
  await db.connect();
  try {
    log('=== Running postprocess SQL ===');
    await db.query(`
DO $$
DECLARE
    rec RECORD;
    table_date DATE;
    current_month TEXT;
    previous_month TEXT;
    current_ndvi_col TEXT;
    previous_ndvi_col TEXT;
BEGIN
    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name LIKE '2026-%-01_%_coupe_NDVI_Change'
          AND SUBSTRING(table_name, 1, 10)::date >= DATE '2026-01-01'
        ORDER BY table_name
    LOOP
        table_date := SUBSTRING(rec.table_name, 1, 10)::date;
        current_month := TO_CHAR(table_date, 'Mon');
        previous_month := TO_CHAR(table_date - INTERVAL '1 month', 'Mon');
        current_ndvi_col := current_month || '_NDVI';
        previous_ndvi_col := previous_month || '_NDVI';

        EXECUTE format('UPDATE public.%I SET change_category = %L;', rec.table_name, 'Degradation');
        EXECUTE format('UPDATE public.%I SET note = NULL WHERE btrim(note) = %L;', rec.table_name, 'NDVI decrease less than -0.3');
        EXECUTE format(
            'UPDATE public.%I
             SET "NDVI_change" = TRUNC("NDVI_change"::numeric, 2),
                 %I = TRUNC(%I::numeric, 2),
                 %I = TRUNC(%I::numeric, 2),
                 status = true;',
            rec.table_name,
            previous_ndvi_col,
            previous_ndvi_col,
            current_ndvi_col,
            current_ndvi_col
        );
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS geom_multipolygon;', rec.table_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN geom_multipolygon geometry(MultiPolygon, 4326);', rec.table_name);
        EXECUTE format(
            'UPDATE public.%I t
             SET geom_multipolygon = ST_Multi(ST_Transform(ST_MakeEnvelope(
                 FLOOR(ST_X(p.utm_geom) / 10) * 10,
                 FLOOR(ST_Y(p.utm_geom) / 10) * 10,
                 FLOOR(ST_X(p.utm_geom) / 10) * 10 + 10,
                 FLOOR(ST_Y(p.utm_geom) / 10) * 10 + 10,
                 32643), 4326))
             FROM (
                 SELECT ctid, ST_Transform(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 32643) AS utm_geom
                 FROM public.%I
                 WHERE latitude IS NOT NULL AND longitude IS NOT NULL
             ) p
             WHERE t.ctid = p.ctid;',
            rec.table_name,
            rec.table_name
        );
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS geom;', rec.table_name);
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN geom_multipolygon TO geom;', rec.table_name);
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS pixle_id;', rec.table_name);
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN id TO pixle_id;', rec.table_name);
    END LOOP;
END $$;
    `);
    log('Postprocess SQL completed.');
  } finally {
    await db.end();
  }
}

async function publishToGeoserver() {
  log('=== Publishing to GeoServer ===');
  await styleExists();
  const published = new Set(await listFeaturetypes());
  const available = new Set(await listAvailableFeaturetypes());
  const candidates = Array.from(new Set([...published, ...available]))
    .filter((name) => name.startsWith('2026'))
    .sort();

  let styled = 0;
  let skipped = 0;
  for (const featuretype of candidates) {
    try {
      if (!published.has(featuretype)) {
        await publishFeaturetype(featuretype);
        published.add(featuretype);
        log(`PUBLISHED ${featuretype}`);
      }

      const attributes = await getAttributeNames(featuretype);
      if (!attributes.has('change_category')) {
        skipped += 1;
        log(`SKIP ${featuretype}: missing change_category`);
        continue;
      }

      await setDefaultStyle(featuretype);
      styled += 1;
      log(`UPDATED ${GEOSERVER_WORKSPACE}:${featuretype} -> ${GEOSERVER_STYLE}`);
    } catch (error) {
      skipped += 1;
      log(`ERROR ${featuretype}: ${error.message || error}`);
    }
  }
  log(`GeoServer publish completed. Styled ${styled}, skipped ${skipped}.`);
}

async function runPostprocessAndPublish() {
  await runPostprocessSql();
  await publishToGeoserver();
}

async function main() {
  log(`Log file: ${logFile}`);
  ensureMonthlySchedule();
  log(`Running ${COUPES.length} coupes for ${MONTH.label} ${runMonth.getFullYear()}.`);
  log(`Comparing ${MONTH.label} (${MONTH.runDate} to ${MONTH.endDate}) - ${MONTH.prevLabel} (${MONTH.prevStart} to ${MONTH.prevEnd})`);
  log(`Columns: ${CURRENT_NDVI_COLUMN}, ${PREV_NDVI_COLUMN}`);

  await validateDbConnection();
  await initializeEarthEngine();

  let failed = 0;
  for (let i = 0; i < COUPES.length; i += 1) {
    const coupe = COUPES[i];
    log(`=== Starting ${coupe} (${i + 1}/${COUPES.length}) ===`);
    try {
      await processCoupe(coupe);
      log(`FINISHED ${coupe}`);
    } catch (error) {
      failed += 1;
      log(`FAILED ${coupe}: ${error.message || error}`);
    }
  }

  log(`All coupes done. Completed ${COUPES.length - failed}, failed ${failed}.`);
  if (failed > 0) {
    log('Skipping postprocess and publish due to failures.');
    process.exitCode = 1;
    return;
  }

  await runPostprocessAndPublish();
  log('All steps complete.');
}

main()
  .catch((error) => {
    const msg = String(error.message || error);
    if (msg.includes('Database connection failed')) {
      log(`FATAL (database): ${msg}`);
      log(`Check DB connectivity to ${DB_HOST}:${DB_PORT} and confirm credentials/database name are correct.`);
    } else if (isTransientError(error)) {
      log(`FATAL (network): ${msg}`);
      log(`This appears to be a network connectivity issue to Google Earth Engine APIs.`);
      log(`Check: 1) Internet connectivity from this server, 2) Firewall rules for outbound HTTPS to earthengine.googleapis.com`);
      log(`You can set HTTPS_PROXY env var if a proxy is required. Retry settings: EE_MAX_RETRIES=${MAX_RETRIES}, EE_INITIAL_BACKOFF_MS=${INITIAL_BACKOFF_MS}`);
    } else {
      log(`FATAL: ${error.stack || msg}`);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    logStream.end();
  });
