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

// ── Database ──────────────────────────────────────────────────────────────────
const DB_NAME = 'recap4ndc';
const DB_USER = 'recap4ndc_postgres';
const DB_PASS = 'Reb@$hyd@08052026';
const DB_HOST = 'gsdc-psql.gujarat.gov.in';
const DB_PORT = 9999;
const DB_SSL = false;
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000);

// ── Proxy support ─────────────────────────────────────────────────────────────
// The @google/earthengine client makes its own HTTPS requests and does NOT
// respect https.globalAgent. We use global-agent which patches Node's HTTP/HTTPS
// stack at the lowest level so ALL outbound connections go through the proxy.
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
if (PROXY_URL) {
  try {
    process.env.GLOBAL_AGENT_HTTP_PROXY = PROXY_URL;
    process.env.GLOBAL_AGENT_HTTPS_PROXY = PROXY_URL;
    // Always exclude the PostgreSQL DB host from proxy — pg uses raw TCP binary
    // protocol; routing it through an HTTP proxy breaks the connection entirely.
    // Also exclude Google APIs (Earth Engine, OAuth) — the corporate proxy times
    // out on these long-lived HTTPS connections. The server has direct internet
    // access to Google's IPs.
    const existingNoProxy = process.env.NO_PROXY || process.env.no_proxy || '';
    const dbNoProxy = `${DB_HOST},172.17.31.173`;
    const googleHosts = 'googleapis.com,accounts.google.com,oauth2.googleapis.com,earthengine.googleapis.com,www.googleapis.com,storage.googleapis.com';
    process.env.GLOBAL_AGENT_NO_PROXY = [existingNoProxy, 'localhost,127.0.0.1', dbNoProxy, googleHosts]
      .filter(Boolean).join(',');
    // Also set standard NO_PROXY so google-auth-library (used by EE) bypasses proxy
    process.env.NO_PROXY = process.env.GLOBAL_AGENT_NO_PROXY;
    process.env.no_proxy = process.env.GLOBAL_AGENT_NO_PROXY;
    const globalAgent = require('global-agent');
    globalAgent.bootstrap();
    // eslint-disable-next-line no-console
    console.log(`[INFO] Using proxy (global-agent): ${PROXY_URL}`);
    console.log(`[INFO] NO_PROXY hosts: ${process.env.GLOBAL_AGENT_NO_PROXY}`);
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
    log(`[CHECK] PostgreSQL OK: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  } catch (error) {
    throw new Error(`PostgreSQL connection failed to ${DB_HOST}:${DB_PORT}/${DB_NAME}: ${error.message || error}`);
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
// GeoServer is optional — if GEOSERVER_URL is not set, the script will skip
// GeoServer validation and publishing, but still process NDVI data and insert
// results into PostgreSQL.
const GEOSERVER_URL             = process.env.GEOSERVER_URL || '';
const GEOSERVER_USER            = process.env.GEOSERVER_USER || '';
const GEOSERVER_PASSWORD        = process.env.GEOSERVER_PASSWORD || '';
const GEOSERVER_WORKSPACE       = process.env.GEOSERVER_WORKSPACE       || 'Recap4NDC';
const GEOSERVER_STORE           = process.env.GEOSERVER_STORE           || 'Recap4NDC_Query';
const GEOSERVER_STYLE_WORKSPACE = process.env.GEOSERVER_STYLE_WORKSPACE || 'Recap4NDC_New';
const GEOSERVER_STYLE           = process.env.GEOSERVER_STYLE           || 'NDVI_CHANGE_NEW2222';
let GEOSERVER_UNREACHABLE = false;

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

// Month key used for checkpoint and monthly log filenames (e.g. "2026-07")
const MONTH_KEY = `${runMonth.getFullYear()}-${pad(runMonth.getMonth() + 1)}`;

const CURRENT_NDVI_COLUMN = `${MONTH.label}_NDVI`;
const PREV_NDVI_COLUMN = `${MONTH.prevLabel}_NDVI`;
const runId = `${MONTH.runDate}_${new Date().toISOString().replace(/[:.]/g, '-')}`;

// ── Log streams ───────────────────────────────────────────────────────────────
const logFile      = path.join(logsDir, `ndvi_${runId}.log`);
const publishedFile = path.join(logsDir, `published_${MONTH_KEY}.log`);
const errorFile    = path.join(logsDir, `errors_${MONTH_KEY}.log`);

const logStream       = fs.createWriteStream(logFile,       { flags: 'a' });
const publishedStream = fs.createWriteStream(publishedFile, { flags: 'a' });
const errorStream     = fs.createWriteStream(errorFile,     { flags: 'a' });

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(`${line}\n`);
}

/** Write a success entry to the published log file. */
function logPublished(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  publishedStream.write(`${line}\n`);
}

/**
 * Write an error entry to the error log file.
 * @param {string} context  Category label, e.g. 'STARTUP', 'COUPE', 'PUBLISH'
 * @param {string} message  Error detail
 */
function logError(context, message) {
  const line = `[${new Date().toISOString()}] [${context}] ${message}`;
  errorStream.write(`${line}\n`);
  // Also surface it in the main log so it's all in one place too
  log(`ERROR [${context}] ${message}`);
}

function writeRaw(data) {
  process.stdout.write(data);
  logStream.write(data);
}

// ── Checkpoint helpers ────────────────────────────────────────────────────────
const checkpointFile = path.join(logsDir, `checkpoint_${MONTH.runDate}.json`);

function loadCheckpoint() {
  try {
    if (fs.existsSync(checkpointFile)) {
      const raw = fs.readFileSync(checkpointFile, 'utf8');
      const data = JSON.parse(raw);
      // Ensure the shape is correct even if the file is from an older version
      return {
        completed: Array.isArray(data.completed) ? data.completed : [],
        failed:    Array.isArray(data.failed)    ? data.failed    : [],
      };
    }
  } catch (err) {
    log(`[WARN] Could not read checkpoint file (${checkpointFile}): ${err.message}. Starting fresh.`);
  }
  return { completed: [], failed: [] };
}

function saveCheckpoint(checkpoint) {
  try {
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf8');
  } catch (err) {
    log(`[WARN] Could not save checkpoint file: ${err.message}`);
  }
}

// ── Scheduled task ────────────────────────────────────────────────────────────
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

// ── GeoServer HTTP helper ─────────────────────────────────────────────────────
function geoserverRequest(method, requestPath, body) {
  const url = new URL(`${GEOSERVER_URL}${requestPath}`);
  const data = body ? JSON.stringify(body) : null;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASSWORD}`).toString('base64')}`,
    Accept: 'application/json',
  };
  if (data) headers['Content-Type'] = 'application/json';

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      request.destroy(new Error(`GeoServer request timed out after 15s: ${method} ${url.href}`));
    }, 15000);

    const request = https.request({
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      headers,
      rejectUnauthorized: false,
      timeout: 15000,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        clearTimeout(timeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${method} ${url.href} failed: HTTP ${response.statusCode}: ${raw}`));
          return;
        }
        resolve(raw ? JSON.parse(raw) : null);
      });
    });
    request.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    if (data) request.write(data);
    request.end();
  });
}

// ── GeoServer connection check ────────────────────────────────────────────────
async function validateGeoServerConnection() {
  log(`[DEBUG] validateGeoServerConnection called, GEOSERVER_URL="${GEOSERVER_URL}"`);
  if (!GEOSERVER_URL) {
    log('[CHECK] GeoServer SKIPPED (GEOSERVER_URL not set — publishing will be skipped)');
    return;
  }
  log('[DEBUG] GeoServer URL is set, attempting connection...');
  try {
    // Use the GeoServer REST /about/version endpoint as a lightweight health check
    await geoserverRequest('GET', '/rest/about/version.json');
    log(`[CHECK] GeoServer OK: ${GEOSERVER_URL}`);
  } catch (error) {
    throw new Error(`GeoServer connection failed at ${GEOSERVER_URL}: ${error.message || error}`);
  }
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

// ── Earth Engine init + validation ────────────────────────────────────────────
function initializeEarthEngine() {
  const key = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY, 'utf8'));
  console.log(`[INFO] EE service account: ${key.client_email}`);
  console.log(`[INFO] EE project: ${key.project_id}`);
  console.log(`[INFO] EE key file: ${SERVICE_ACCOUNT_KEY}`);

  // The @google/earthengine SDK uses Node's https module internally.
  // global-agent should bypass Google hosts via NO_PROXY, but the EE SDK
  // also reads HTTPS_PROXY directly in some code paths. Temporarily clear
  // ALL proxy env vars during EE init so it connects directly to Google.
  const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'GLOBAL_AGENT_HTTP_PROXY', 'GLOBAL_AGENT_HTTPS_PROXY'];
  const savedProxy = {};
  proxyKeys.forEach((k) => { if (process.env[k]) { savedProxy[k] = process.env[k]; delete process.env[k]; } });
  console.log('[INFO] Temporarily cleared proxy env vars for EE init (direct connection to Google)');

  return retryWithBackoff(() => {
    return new Promise((resolve, reject) => {
      // Add a 60s timeout so we don't hang forever
      const timeout = setTimeout(() => {
        reject(new Error('EE init timed out after 60s — check direct connectivity to oauth2.googleapis.com:443 and earthengine.googleapis.com:443'));
      }, 60000);

      ee.data.authenticateViaPrivateKey(
        key,
        () => {
          console.log('[INFO] EE authenticateViaPrivateKey succeeded, calling ee.initialize()...');
          ee.initialize(null, null, () => {
            clearTimeout(timeout);
            console.log('[INFO] ee.initialize() succeeded');
            // Restore proxy env vars after EE init
            Object.assign(process.env, savedProxy);
            console.log('[INFO] Proxy env vars restored after EE init');
            resolve();
          }, (err) => {
            clearTimeout(timeout);
            console.error('[ERROR] ee.initialize() failed:', err);
            Object.assign(process.env, savedProxy);
            reject(err);
          });
        },
        (err) => {
          clearTimeout(timeout);
          console.error('[ERROR] ee.data.authenticateViaPrivateKey failed:', err);
          Object.assign(process.env, savedProxy);
          reject(err);
        }
      );
    });
  }, 'EE init');
}

/**
 * After initializeEarthEngine(), do a trivial server-side evaluate to confirm
 * the EE API is actually reachable and responding.
 */
async function validateEarthEngineApi() {
  try {
    await retryWithBackoff(() => {
      return new Promise((resolve, reject) => {
        ee.Number(1).evaluate((result, error) => {
          if (error) reject(new Error(String(error)));
          else if (result !== 1) reject(new Error(`Unexpected EE validation result: ${result}`));
          else resolve();
        });
      });
    }, 'EE validate', 3);
    log('[CHECK] Google Earth Engine API OK');
  } catch (error) {
    throw new Error(`Google Earth Engine API check failed: ${error.message || error}`);
  }
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

// ── NDVI computation helpers ──────────────────────────────────────────────────
function maskS2Clouds(image) {
  const qa = image.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start']);
}

function ndviComposite(startDate, endDate, geometry) {
  const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
    .map(maskS2Clouds);

  const composite = ee.Image(ee.Algorithms.If(
    collection.size().gt(0),
    collection.median(),
    ee.Image(0).rename(['B8', 'B4'])
  ));

  return composite.normalizedDifference(['B8', 'B4']);
}

function changeCategory(value) {
  if (value < -CHANGE_THRESHOLD) return 'Degradation';
  return 'no_significant_change';
}

// ── Database helpers ──────────────────────────────────────────────────────────
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
        const rowMsg = `${sourceTable} row id=${rows[i].id}: ${error.message || error}`;
        logError('COUPE', rowMsg);
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

// ── GeoServer publish ─────────────────────────────────────────────────────────
async function publishToGeoserver() {
  if (!GEOSERVER_URL || GEOSERVER_UNREACHABLE) {
    log('=== GeoServer publish SKIPPED (GeoServer not available) ===');
    return;
  }
  log('=== Publishing to GeoServer ===');
  log(`Published layers list: ${publishedFile}`);
  log(`Publish errors list:   ${errorFile}`);

  await styleExists();
  const published = new Set(await listFeaturetypes());
  const available = new Set(await listAvailableFeaturetypes());
  const candidates = Array.from(new Set([...published, ...available]))
    .filter((name) => name.startsWith('2026'))
    .sort();

  // Log the full list of candidate layers so the user can audit it
  log(`Candidate layers to process (${candidates.length}):`);
  candidates.forEach((name) => log(`  - ${name}`));

  let styled = 0;
  let skipped = 0;
  for (const featuretype of candidates) {
    try {
      if (!published.has(featuretype)) {
        await publishFeaturetype(featuretype);
        published.add(featuretype);
        log(`PUBLISHED ${featuretype}`);
        logPublished(`PUBLISHED  ${featuretype}`);
      }

      const attributes = await getAttributeNames(featuretype);
      if (!attributes.has('change_category')) {
        skipped += 1;
        log(`SKIP ${featuretype}: missing change_category`);
        logError('PUBLISH', `SKIP ${featuretype}: missing change_category attribute`);
        continue;
      }

      await setDefaultStyle(featuretype);
      styled += 1;
      log(`STYLED     ${GEOSERVER_WORKSPACE}:${featuretype} -> ${GEOSERVER_STYLE}`);
      logPublished(`STYLED     ${GEOSERVER_WORKSPACE}:${featuretype} -> ${GEOSERVER_STYLE}`);
    } catch (error) {
      skipped += 1;
      logError('PUBLISH', `${featuretype}: ${error.message || error}`);
    }
  }
  log(`GeoServer publish completed. Styled ${styled}, skipped ${skipped}.`);
}

async function runPostprocessAndPublish() {
  await runPostprocessSql();
  await publishToGeoserver();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Log file:       ${logFile}`);
  log(`Published log:  ${publishedFile}`);
  log(`Error log:      ${errorFile}`);
  log(`Checkpoint:     ${checkpointFile}`);

  ensureMonthlySchedule();

  log(`Running ${COUPES.length} coupes for ${MONTH.label} ${runMonth.getFullYear()}.`);
  log(`Comparing ${MONTH.label} (${MONTH.runDate} to ${MONTH.endDate}) - ${MONTH.prevLabel} (${MONTH.prevStart} to ${MONTH.prevEnd})`);
  log(`Columns: ${CURRENT_NDVI_COLUMN}, ${PREV_NDVI_COLUMN}`);

  // ── 1. Startup connection checks ──────────────────────────────────────────
  log('=== Checking service connections ===');

  try {
    await validateDbConnection();
  } catch (error) {
    logError('STARTUP', `PostgreSQL: ${error.message || error}`);
    throw error; // caught by main().catch() for FATAL handling
  }

  try {
    await initializeEarthEngine();
    await validateEarthEngineApi();
  } catch (error) {
    logError('STARTUP', `Google Earth Engine: ${error.message || error}`);
    throw error;
  }

  log('[DEBUG] About to validate GeoServer connection...');
  try {
    await validateGeoServerConnection();
  } catch (error) {
    logError('STARTUP', `GeoServer: ${error.message || error}`);
    log('[WARN] GeoServer not reachable — processing will continue but publishing will be skipped.');
    process.env.GEOSERVER_URL = '';
    // Update the const reference by setting a flag
    GEOSERVER_UNREACHABLE = true;
  }

  log('[DEBUG] All connection checks passed, starting processing...');

  log('=== All services reachable. Starting processing. ===');

  // ── 2. Load checkpoint (resume support) ───────────────────────────────────
  const checkpoint = loadCheckpoint();
  const completedSet = new Set(checkpoint.completed);

  if (completedSet.size > 0) {
    log(`[RESUME] Found checkpoint. Already completed ${completedSet.size} coupe(s): ${checkpoint.completed.join(', ')}`);
    log(`[RESUME] Skipping those and continuing from where we left off.`);
  } else {
    log('[START] No checkpoint found. Starting fresh run.');
  }

  // ── 3. Process coupes with checkpoint save after each ─────────────────────
  let failed = 0;
  for (let i = 0; i < COUPES.length; i += 1) {
    const coupe = COUPES[i];

    if (completedSet.has(coupe)) {
      log(`[SKIP] ${coupe} (${i + 1}/${COUPES.length}) – already completed in this run.`);
      continue;
    }

    log(`=== Starting ${coupe} (${i + 1}/${COUPES.length}) ===`);
    try {
      await processCoupe(coupe);
      log(`FINISHED ${coupe}`);

      // Mark as completed and save checkpoint immediately
      checkpoint.completed.push(coupe);
      completedSet.add(coupe);
      // Remove from failed list in case it was previously failed and is now retried
      checkpoint.failed = checkpoint.failed.filter((c) => c !== coupe);
      saveCheckpoint(checkpoint);
    } catch (error) {
      failed += 1;
      const msg = `${coupe}: ${error.message || error}`;
      logError('COUPE', msg);
      log(`FAILED ${coupe}`);

      if (!checkpoint.failed.includes(coupe)) {
        checkpoint.failed.push(coupe);
      }
      saveCheckpoint(checkpoint);
    }
  }

  log(`All coupes done. Completed ${COUPES.length - failed}, failed ${failed}.`);
  if (failed > 0) {
    log('Skipping postprocess and publish due to failures.');
    log(`Re-run the script to resume from the checkpoint and retry failed coupes.`);
    process.exitCode = 1;
    return;
  }

  await runPostprocessAndPublish();
  log('All steps complete.');

  // Clean up checkpoint on full success so the next month starts fresh
  try {
    fs.unlinkSync(checkpointFile);
    log(`[DONE] Checkpoint file removed (clean run complete).`);
  } catch (_) {}
}

// Catch silent crashes
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.stack || err);
  log(`[UNCAUGHT EXCEPTION] ${err.stack || err}`);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  log(`[UNHANDLED REJECTION] ${reason}`);
});

main()
  .catch((error) => {
    const msg = String(error.message || error);
    if (msg.includes('PostgreSQL connection failed')) {
      log(`FATAL (database): ${msg}`);
      log(`Check DB connectivity to ${DB_HOST}:${DB_PORT} and confirm credentials/database name are correct.`);
    } else if (msg.includes('Google Earth Engine')) {
      log(`FATAL (earth engine): ${msg}`);
      log(`Check: 1) Internet connectivity, 2) Service account key is valid, 3) Firewall rules for outbound HTTPS to earthengine.googleapis.com`);
      log(`You can set HTTPS_PROXY env var if a proxy is required. Retry settings: EE_MAX_RETRIES=${MAX_RETRIES}, EE_INITIAL_BACKOFF_MS=${INITIAL_BACKOFF_MS}`);
    } else if (msg.includes('GeoServer connection failed')) {
      log(`FATAL (geoserver): ${msg}`);
      log(`Check: 1) GEOSERVER_URL is set correctly, 2) GEOSERVER_USER/GEOSERVER_PASSWORD are valid, 3) Network access to GeoServer host.`);
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
    publishedStream.end();
    errorStream.end();
  });
