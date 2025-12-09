// routers/mon2.js
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');
const wellknown = require('wellknown'); // npm i wellknown
const privatekey = require("./giz-gujarat-7624cd92559c.json"); // adjust path as needed
const { sequelize, testConnection } = require('../config/ndvidatabase');

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry helper with exponential backoff
async function withRetry(fn, attempts = 5, baseDelay = 1000) {
  let i = 0;
  while (i < attempts) {
    try {
      return await fn();
    } catch (err) {
      i++;
      const isLast = i >= attempts;
      console.error(`Attempt ${i} failed: ${err && err.message ? err.message : err}.`);
      if (isLast) throw err;
      const backoff = baseDelay * Math.pow(2, i - 1);
      console.log(`Retrying after ${backoff}ms...`);
      await sleep(backoff);
      // If sequelize connection seems closed, try re-authenticating
      try {
        await sequelize.authenticate();
        console.log('✅ Re-authenticated to DB after failure.');
      } catch (authErr) {
        console.warn('⚠️ Re-authentication failed:', authErr.message || authErr);
      }
    }
  }
}

// ----------------- GRID MAKER -----------------
function makeGrid(geom, tileSizeMeters) {
  // create projection at scale - note: EPSG:4326 atScale uses degrees approx; this is what you had before.
  const proj = ee.Projection('EPSG:4326').atScale(tileSizeMeters);
  return ee.FeatureCollection(
    ee.Geometry(geom)
      .coveringGrid(proj)
      .map(f => f.intersection(geom, 1))
  );
}

// ----------------- EE evaluate wrapper -----------------
function evaluateFC(fc) {
  return new Promise((resolve, reject) => {
    fc.evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ----------------- NDVI Mask Function -----------------
function maskS2(img) {
  return img.updateMask(
    img.select(['B2','B3','B4','B8'])
      .reduce(ee.Reducer.min())
      .gt(0)
  );
}

// ----------------- Sentinel-2 NDVI -----------------
function getS2NDVI(start, end, geom) {
  const s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterDate(start, end)
    .filterBounds(geom)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80));

  const emptyCollection = s2.size().eq(0);
  const nullNdvi = ee.Image.constant(0)
    .rename("NDVI")
    .updateMask(ee.Image(0));

  const median = s2.map(maskS2).median();
  const hasBands = median.bandNames().size().gt(0);

  const ndvi = ee.Algorithms.If(
    emptyCollection.or(hasBands.not()),
    nullNdvi,
    median.normalizedDifference(["B8", "B4"]).rename("NDVI")
  );

  return ee.Image(ndvi);
}

// ----------------- Create table if not exists -----------------
async function createTableIfNotExists(tableName) {
  // sanitize tableName for index name
  const idxName = `idx_${tableName.replace(/[^a-zA-Z0-9]/g, '_')}_geom`;
  const sqlCreate = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      coop_id INTEGER,
      coop_name VARCHAR(255),
      poly_id INTEGER,
      valNdvi DECIMAL(10,6),
      geom GEOMETRY(POLYGON, 4326),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const sqlIndex = `
    CREATE INDEX IF NOT EXISTS "${idxName}"
    ON "${tableName}" USING GIST (geom);
  `;

  await withRetry(() => sequelize.query(sqlCreate));
  await withRetry(() => sequelize.query(sqlIndex));
  console.log(`✅ Table '${tableName}' ensured to exist (and index).`);
}

// ----------------- Build bulk insert query -----------------
// rows: array of objects { coop_id, coop_name, poly_id, valNdvi, wkt }
function buildBulkInsert(table, rows) {
  // Each row uses 5 params (we'll pass WKT into ST_GeomFromText)
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const r of rows) {
    // ($1,$2,$3,$4, ST_GeomFromText($5,4326))
    const group = [
      `$${paramIdx++}`, // coop_id
      `$${paramIdx++}`, // coop_name
      `$${paramIdx++}`, // poly_id
      `$${paramIdx++}`, // valNdvi
      `ST_GeomFromText($${paramIdx++}, 4326)` // wkt
    ];
    values.push(`(${group.join(',')})`);
    params.push(r.coop_id, r.coop_name, r.poly_id, r.valNdvi, r.wkt);
  }

  const sql = `INSERT INTO "${table}" (coop_id, coop_name, poly_id, valNdvi, geom) VALUES ${values.join(', ')};`;
  return { sql, params };
}

// ----------------- Insert polygons into DB (batched + retries) -----------------
async function insertPolygonsFromFile(ndviFC, table, coop, polyID, options = {}) {
  if (!ndviFC?.features || ndviFC.features.length === 0) return 0;
  const batchSize = options.batchSize || 200; // number of rows per insert
  const delayBetweenBatches = options.delayBetweenBatches || 50; // ms

  // Prepare rows: convert each geometry to WKT and prepare params
  const rows = [];
  for (const f of ndviFC.features) {
    if (!f || !f.geometry) continue;

    // Convert GeoJSON to WKT (wellknown)
    let wkt;
    try {
      wkt = wellknown.stringify(f.geometry);
      if (!wkt) continue;
    } catch (err) {
      console.warn('Invalid geometry for feature, skipping', err && err.message);
      continue;
    }

    const valNdvi = (typeof f.properties?.mean === 'number') ? (f.properties.mean / 1000.0) : null;

    rows.push({
      coop_id: coop.coupe_code || 1,
      coop_name: coop.coupe_name || 'unknown',
      poly_id: polyID,
      valNdvi: valNdvi,
      wkt: wkt
    });
  }

  if (rows.length === 0) return 0;

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { sql, params } = buildBulkInsert(table, batch);

    // Run with retry wrapper
    await withRetry(() => sequelize.query(sql, { bind: params, logging: false }));

    inserted += batch.length;
    // small sleep to reduce pressure on DB
    await sleep(delayBetweenBatches);
  }

  return inserted;
}

// ----------------- MAIN -----------------
async function main() {
  // Authenticate Earth Engine via service account key and initialize
  await new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privatekey, () => {
      ee.initialize(null, null, resolve, reject);
    }, reject);
  });
  console.log("✅ EE initialized");

  // Test DB connection and attempt re-auth if needed
  const ok = await testConnection();
  if (!ok) {
    console.error('Exiting: cannot connect to DB.');
    process.exit(1);
  }
  console.log("✅ DB connected");

  const months = [
    '2025-03-01'
  ];

  const monthTables = months.map(m => {
    const mm = new Date(m).toLocaleString('en', { month: 'short' }).toLowerCase();
    return `ndvi_poly_${mm}_2025`;
  });

  // Ensure tables exist
  for (const table of monthTables) {
    await createTableIfNotExists(table);
  }

  // Load coupe metadata (assuming table exists and column names)
  const [coops] = await sequelize.query(`
    SELECT * FROM coupe_metadata
    WHERE coupe_name = 'Sabarkantha_North_Aravalli'
    LIMIT 1;
  `);
  if (!coops || coops.length === 0) {
    throw new Error('Coupe metadata row not found for Sabarkantha_North_Aravalli');
  }
  const coop = coops[0];

  // Fetch polygons from the named table (ensure the table name is safe in your DB)
  const safeTableName = coop.coupe_name; // if this contains special chars, ensure it exists as is
  const [rows] = await sequelize.query(`
    SELECT id, ST_AsGeoJSON(geom) AS geomjson
    FROM "${safeTableName}"
    WHERE geom IS NOT NULL;
  `);

  const polygons = rows.filter(r => {
    try {
      if (!r.geomjson) return false;
      JSON.parse(r.geomjson);
      return true;
    } catch (err) {
      return false;
    }
  });

  console.log(`Found ${polygons.length} valid polygons.`);

  // Process months
  for (let m = 0; m < months.length; m++) {
    const month = months[m];
    const table = monthTables[m];

    const start = month;
    const endObj = new Date(month);
    endObj.setMonth(endObj.getMonth() + 1);
    const end = endObj.toISOString().slice(0, 10);

    console.log(`\n📅 Processing: ${month} → ${table}`);

    for (const row of polygons) {
      // parse polygon geometry
      const geom = ee.Geometry(JSON.parse(row.geomjson));
      // Increase tile size to reduce number of tiles (from 265 to 500)
      const tiles = makeGrid(geom, 500);

      // Get total tile count
      const totalTiles = tiles.size().getInfo();
      console.log(`🧩 Total tiles for polygon ${row.id}: ${totalTiles}`);
      
      // Process tiles in batches to avoid ENAMETOOLONG error
      const BATCH_SIZE = 30; // Process 30 tiles at a time
      let processedTiles = 0;
      
      while (processedTiles < totalTiles) {
        // Get a batch of tiles
        const tileBatch = await tiles
          .toList(BATCH_SIZE, processedTiles)
          .getInfo();
        
        const batchNumber = Math.floor(processedTiles / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalTiles / BATCH_SIZE);
        console.log(`   Processing batch ${batchNumber}/${totalBatches} (${tileBatch.length} tiles)`);
        
        for (const tileFeature of tileBatch) {
          try {
            const tileGeom = ee.Geometry(tileFeature.geometry);

            // Compute NDVI for THIS tile
            const ndvi = getS2NDVI(start, end, tileGeom);
            const ndviInt = ndvi.multiply(1000).toInt16();

            // Polygonize NDVI for THIS tile with increased scale
            const vectors = ndviInt.reduceToVectors({
              geometry: tileGeom,
              scale: 100, // Increased from 30 to reduce complexity
              geometryType: "polygon",
              labelProperty: "mean",
              bestEffort: true,
              maxPixels: 1e8 // Add max pixels limit
            });

            const ndviFC = await evaluateFC(vectors);

            // Insert polygons in bulk (batched)
            const inserted = await insertPolygonsFromFile(ndviFC, table, coop, row.id, {
              batchSize: 100, // Reduced from 200
              delayBetweenBatches: 100
            });

            console.log(`     ↳ Tile processed, polygons inserted: ${inserted}`);
            // Increase pause between tiles
            await sleep(100);
          } catch (tileErr) {
            console.error('⚠️ Error processing tile (continuing to next):', tileErr && tileErr.message ? tileErr.message : tileErr);
            // If connection terminated, try to re-authenticate
            try {
              await sequelize.authenticate();
              console.log('✅ DB re-authenticated after tile error.');
            } catch (reAuthErr) {
              console.warn('Re-auth failed after tile error:', reAuthErr && reAuthErr.message ? reAuthErr.message : reAuthErr);
            }
          }
        }
        
        processedTiles += tileBatch.length;
        
        // Add longer delay between batches to reduce load
        if (processedTiles < totalTiles) {
          console.log(`   ⏳ Waiting 2 seconds before next batch...`);
          await sleep(2000);
        }
      }
    }
  }

  console.log("\n🎉 NDVI Polygon Processing Finished!");
  await sequelize.close();
}

main().catch(err => {
  console.error('❌ Fatal error in main function:', err && err.message ? err.message : err);
  process.exit(1);
});