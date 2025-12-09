// routers/mon2.js
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');
const wellknown = require('wellknown');
const privatekey = require("./giz-gujarat-7624cd92559c.json");
const { sequelize, testConnection } = require('./config/ndvidatabase');

// Checkpoint file path
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint.json');

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

// Load checkpoint if exists
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      console.log('📌 Loaded checkpoint:', data);
      return data;
    }
  } catch (err) {
    console.warn('⚠️ Could not load checkpoint:', err.message);
  }
  return null;
}

// Save checkpoint
function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Checkpoint saved:', data);
  } catch (err) {
    console.error('❌ Failed to save checkpoint:', err.message);
  }
}

// Clear checkpoint (call when processing is complete)
function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('🧹 Checkpoint cleared');
    }
  } catch (err) {
    console.warn('⚠️ Could not clear checkpoint:', err.message);
  }
}

// ----------------- GRID MAKER -----------------
function makeGrid(geom, tileSizeMeters) {
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
  const idxName = `idx_${tableName.replace(/[^a-zA-Z0-9]/g, '_')}_geom`;
  const sqlCreate = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
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
function buildBulkInsert(table, rows) {
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const r of rows) {
    const group = [
      `$${paramIdx++}`, // coop_name
      `$${paramIdx++}`, // poly_id
      `$${paramIdx++}`, // valNdvi
      `ST_GeomFromText($${paramIdx++}, 4326)` // wkt
    ];
    values.push(`(${group.join(',')})`);
    params.push(r.coop_name, r.poly_id, r.valNdvi, r.wkt);
  }

  const sql = `INSERT INTO "${table}" (coop_name, poly_id, valNdvi, geom) VALUES ${values.join(', ')};`;
  return { sql, params };
}

// ----------------- Insert polygons into DB (batched + retries) -----------------
async function insertPolygonsFromFile(ndviFC, table, coop, polyID, options = {}) {
  if (!ndviFC?.features || ndviFC.features.length === 0) return 0;
  const batchSize = options.batchSize || 200;
  const delayBetweenBatches = options.delayBetweenBatches || 50;

  const rows = [];
  for (const f of ndviFC.features) {
    if (!f || !f.geometry) continue;

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
      coop_name: coop.coupe_name || 'unknown',
      poly_id: polyID,
      valNdvi: valNdvi,
      wkt: wkt
    });
  }

  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { sql, params } = buildBulkInsert(table, batch);

    await withRetry(() => sequelize.query(sql, { bind: params, logging: false }));

    inserted += batch.length;
    await sleep(delayBetweenBatches);
  }

  return inserted;
}

// Generate safe table name
function generateTableName(coupeName, month, year) {
  // Clean coupe name: remove special characters, replace spaces with underscores
  const cleanCoupeName = coupeName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .toLowerCase();
  
  // Get month abbreviation
  const monthAbbr = new Date(month).toLocaleString('en', { month: 'short' }).toLowerCase();
  
  // Generate table name
  return `ndvi_${cleanCoupeName}_${monthAbbr}_${year}`;
}

// ----------------- MAIN -----------------
async function main() {
  // Load checkpoint if exists
  const checkpoint = loadCheckpoint();
  
  // Initialize Earth Engine
  await new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privatekey, () => {
      ee.initialize(null, null, resolve, reject);
    }, reject);
  });
  console.log("✅ EE initialized");

  // Test DB connection
  const ok = await testConnection();
  if (!ok) {
    console.error('Exiting: cannot connect to DB.');
    process.exit(1);
  }
  console.log("✅ DB connected");

  const months = [
    '2025-01-01',  // January
    '2025-02-01',  // February
    '2025-03-01',  // March
    '2025-04-01',  // April
    '2025-05-01',  // May
    '2025-06-01',  // June
    '2025-07-01',  // July
    '2025-08-01',  // August
    '2025-09-01',  // September
    '2025-10-01',  // October
    '2025-11-01',  // November
  ];
  
  const year = '2025';

  // Load all coupes from metadata
  const [allCoupes] = await sequelize.query(`
    SELECT DISTINCT coupe_name FROM coupe_metadata
    ORDER BY coupe_name;
  `);
  
  if (!allCoupes || allCoupes.length === 0) {
    throw new Error('No coupe metadata found in the database');
  }

  console.log(`Found ${allCoupes.length} coupes to process.`);

  // Determine where to resume from checkpoint
  let startCoupeIndex = 0;
  let startMonthIndex = 0;
  let startPolygonIndex = 0;
  let startTileIndex = 0;

  if (checkpoint) {
    // Find coupe index
    const coupeIndex = allCoupes.findIndex(c => 
      c.coupe_name === checkpoint.coupeName
    );
    
    if (coupeIndex !== -1) {
      startCoupeIndex = coupeIndex;
      startMonthIndex = months.indexOf(checkpoint.month) || 0;
      startPolygonIndex = checkpoint.polygonIndex || 0;
      startTileIndex = checkpoint.tileIndex || 0;
      console.log(`🔄 Resuming from: Coupe ${checkpoint.coupeName}, Month ${checkpoint.month}, Polygon ${startPolygonIndex}, Tile ${startTileIndex}`);
    }
  }

  // Process each coupe
  for (let c = startCoupeIndex; c < allCoupes.length; c++) {
    const coop = allCoupes[c];
    const coopName = coop.coupe_name;
    
    console.log(`\n🌳 Processing coupe: ${coopName} (${c + 1}/${allCoupes.length})`);
    
    // Save checkpoint at start of each coupe
    saveCheckpoint({
      coupeName: coopName,
      coupeIndex: c,
      month: months[0],
      polygonIndex: 0,
      tileIndex: 0,
      timestamp: new Date().toISOString()
    });

    // Generate table names for this coupe for all months
    const monthTables = {};
    for (const month of months) {
      const tableName = generateTableName(coopName, month, year);
      monthTables[month] = tableName;
      await createTableIfNotExists(tableName);
    }

    // Check if polygon table exists for this coupe
    try {
      const [tableExists] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${coopName}'
        );
      `);
      
      if (!tableExists[0].exists) {
        console.error(`❌ Table '${coopName}' does not exist. Skipping this coupe.`);
        continue;
      }
    } catch (err) {
      console.error(`❌ Error checking table existence for '${coopName}':`, err.message);
      continue;
    }

    // Fetch polygons for this coupe
    const [rows] = await sequelize.query(`
      SELECT id, ST_AsGeoJSON(geom) AS geomjson
      FROM "${coopName}"
      WHERE geom IS NOT NULL
      ORDER BY id;
    `);

    const polygons = rows.filter(r => {
      try {
        if (!r.geomjson) return false;
        JSON.parse(r.geomjson);
        return true;
      } catch (err) {
        console.warn(`Skipping polygon ${r.id}: Invalid geometry`, err.message);
        return false;
      }
    });

    console.log(`📊 Found ${polygons.length} valid polygons for coupe ${coopName}.`);

    // Process each month for this coupe
    for (let m = (c === startCoupeIndex ? startMonthIndex : 0); m < months.length; m++) {
      const month = months[m];
      const table = monthTables[month];

      const start = month;
      const endObj = new Date(month);
      endObj.setMonth(endObj.getMonth() + 1);
      const end = endObj.toISOString().slice(0, 10);

      console.log(`\n📅 Processing: ${month} → ${table}`);

      // Process polygons for this month (starting from checkpoint if applicable)
      for (let p = (c === startCoupeIndex && m === startMonthIndex ? startPolygonIndex : 0); p < polygons.length; p++) {
        const row = polygons[p];
        
        // Save checkpoint at start of each polygon
        saveCheckpoint({
          coupeName: coopName,
          coupeIndex: c,
          month: month,
          polygonId: row.id,
          polygonIndex: p,
          tileIndex: 0,
          timestamp: new Date().toISOString()
        });

        try {
          const geom = ee.Geometry(JSON.parse(row.geomjson));
          const tiles = makeGrid(geom, 500);

          const totalTiles = tiles.size().getInfo();
          console.log(`🧩 Polygon ${row.id}: Total tiles: ${totalTiles}`);
          
          // Determine starting tile based on checkpoint
          let startTile = 0;
          if (checkpoint && 
              checkpoint.coupeName === coopName && 
              checkpoint.month === month && 
              checkpoint.polygonId === row.id) {
            startTile = checkpoint.tileIndex || 0;
            console.log(`🔄 Resuming polygon ${row.id} from tile ${startTile}`);
          }
          
          const BATCH_SIZE = 30;
          let processedTiles = startTile;
          
          while (processedTiles < totalTiles) {
            const tileBatch = await tiles
              .toList(BATCH_SIZE, processedTiles)
              .getInfo();
            
            const batchNumber = Math.floor(processedTiles / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(totalTiles / BATCH_SIZE);
            console.log(`   Processing batch ${batchNumber}/${totalBatches} (${tileBatch.length} tiles)`);
            
            for (const tileFeature of tileBatch) {
              try {
                const tileGeom = ee.Geometry(tileFeature.geometry);

                const ndvi = getS2NDVI(start, end, tileGeom);
                const ndviInt = ndvi.multiply(1000).toInt16();

                const vectors = ndviInt.reduceToVectors({
                  geometry: tileGeom,
                  scale: 100,
                  geometryType: "polygon",
                  labelProperty: "mean",
                  bestEffort: true,
                  maxPixels: 1e8
                });

                const ndviFC = await evaluateFC(vectors);

                const inserted = await insertPolygonsFromFile(ndviFC, table, 
                  { coupe_name: coopName }, // Pass only coupe_name
                  row.id, {
                  batchSize: 100,
                  delayBetweenBatches: 100
                });

                console.log(`     ↳ Tile ${processedTiles + 1}/${totalTiles}, polygons inserted: ${inserted}`);
                
                // Update checkpoint after each successful tile
                saveCheckpoint({
                  coupeName: coopName,
                  coupeIndex: c,
                  month: month,
                  polygonId: row.id,
                  polygonIndex: p,
                  tileIndex: processedTiles + 1,
                  timestamp: new Date().toISOString()
                });
                
                await sleep(100);
              } catch (tileErr) {
                console.error('⚠️ Error processing tile (continuing to next):', tileErr && tileErr.message ? tileErr.message : tileErr);
                
                // Save checkpoint before retrying
                saveCheckpoint({
                  coupeName: coopName,
                  coupeIndex: c,
                  month: month,
                  polygonId: row.id,
                  polygonIndex: p,
                  tileIndex: processedTiles,
                  timestamp: new Date().toISOString(),
                  error: tileErr.message
                });
                
                try {
                  await sequelize.authenticate();
                  console.log('✅ DB re-authenticated after tile error.');
                } catch (reAuthErr) {
                  console.warn('Re-auth failed after tile error:', reAuthErr && reAuthErr.message ? reAuthErr.message : reAuthErr);
                }
              }
              
              processedTiles++;
            }
            
            // Add longer delay between batches
            if (processedTiles < totalTiles) {
              console.log(`   ⏳ Waiting 2 seconds before next batch...`);
              await sleep(2000);
            }
          }
        } catch (geomErr) {
          console.error(`❌ Error processing polygon ${row.id}:`, geomErr.message);
          continue;
        }
      }
      
      // Reset polygon index for next month
      startPolygonIndex = 0;
    }
    
    // Reset month index for next coupe
    startMonthIndex = 0;
    
    console.log(`\n✅ Completed processing for coupe: ${coopName}`);
  }

  // Clear checkpoint when done
  clearCheckpoint();
  console.log("\n🎉 All coupes processed successfully!");
  await sequelize.close();
}

main().catch(err => {
  console.error('❌ Fatal error in main function:', err && err.message ? err.message : err);
  process.exit(1);
});