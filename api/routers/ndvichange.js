const ee = require('@google/earthengine');
const privatekey = require("./private-key.json");
const { sequelize } = require('../config/database');

var months = [
  {current: '2025-01-20', previous: '2024-12-01'},
  {current: '2025-02-20', previous: '2025-01-01'},
  {current: '2025-03-20', previous: '2025-02-01'},
  {current: '2025-04-20', previous: '2025-03-01'},
  {current: '2025-05-20', previous: '2025-04-01'},
  {current: '2025-06-20', previous: '2025-05-01'},
  {current: '2025-07-20', previous: '2025-06-01'},
  {current: '2025-08-20', previous: '2025-07-01'},
  {current: '2025-09-20', previous: '2025-08-01'},
  {current: '2025-10-20', previous: '2025-09-01'}
];

// ----------------- Earth Engine Authentication -----------------
async function initializeEarthEngine() {
  try {
    // Initialize Earth Engine with service account credentials
    await ee.data.authenticateViaPrivateKey(privatekey);
    
    // Initialize the client library
    await ee.initialize(null, null, () => {
      console.log('✅ Earth Engine initialized successfully');
    });
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Earth Engine:', error.message);
    return false;
  }
}

// ----------------- Helper Functions -----------------
function makeGrid(geom, tileSizeMeters = 1000) {
  const proj = ee.Projection('EPSG:3857').atScale(tileSizeMeters);
  return ee.FeatureCollection(
    ee.Geometry(geom).coveringGrid(proj).map(f => f.intersection(geom, 1))
  );
}

function evaluateFC(fc) {
  return new Promise((resolve, reject) => {
    fc.evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function maskS2(image) {
  const valid = image.select(['B2', 'B3', 'B4', 'B8']).reduce(ee.Reducer.min()).gt(0);
  return image.updateMask(valid);
}

function cleanGeoJSON(geojson) {
  if (!geojson || !geojson.coordinates) {
    console.log('⚠️ Invalid GeoJSON: missing coordinates');
    return null;
  }
  
  try {
    const removeZValues = (coords) => {
      if (Array.isArray(coords[0])) {
        return coords.map(removeZValues);
      } else {
        // Return only first two coordinates (longitude, latitude)
        return coords.slice(0, 2);
      }
    };

    const cleaned = JSON.parse(JSON.stringify(geojson));
    
    if (cleaned.type === 'MultiPolygon') {
      cleaned.coordinates = cleaned.coordinates.map(polygon =>
        polygon.map(ring =>
          ring.map(coord => removeZValues(coord))
        )
      );
    } else if (cleaned.type === 'Polygon') {
      cleaned.coordinates = cleaned.coordinates.map(ring =>
        ring.map(coord => removeZValues(coord))
      );
    }
    
    // Validate the cleaned geometry
    if (!cleaned.coordinates || cleaned.coordinates.length === 0) {
      console.log('⚠️ Invalid GeoJSON: empty coordinates after cleaning');
      return null;
    }
    
    return cleaned;
  } catch (error) {
    console.error('❌ Error cleaning GeoJSON:', error.message);
    return null;
  }
}

function detectDeforestation(previousMonthImage, currentMonthImage, geometry) {
  const ndviPrevious = previousMonthImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
  const ndviCurrent = currentMonthImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
  const forestThreshold = 0.0001;
  
  // Detect any negative change (including very small negative changes like -0.00000001)
  const ndviChange = ndviCurrent.subtract(ndviPrevious);
  const wasForest = ndviPrevious.gt(forestThreshold);
  
  // Any negative change in forest areas is considered potential deforestation
  const deforestation = wasForest.and(ndviChange.lt(0));
  
  return {
    deforestation: deforestation.rename('deforestation'),
    ndviPrevious,
    ndviCurrent,
    ndviChange,
    changeMagnitude: ndviChange.multiply(-1).rename('change_magnitude'), // Positive value for negative change
    geometry
  };
}

async function processDeforestation(deforestationTable, row, deforestationData, month) {
  try {
    const geom = ee.Geometry(row.geometry);
    const tiles = makeGrid(geom, 1000);
    const tileList = await evaluateFC(tiles);
    let deforestationCount = 0;
    let insertedFeatures = [];
    
    for (const tileFeature of (tileList.features || [])) {
      const tileGeom = ee.Geometry(tileFeature.geometry);
      
      // Get deforestation areas with change magnitude
      const deforestationWithChange = deforestationData.deforestation
        .updateMask(deforestationData.deforestation)
        .addBands(deforestationData.changeMagnitude);
        
      const deforestationVectors = deforestationWithChange
        .reduceToVectors({
          geometry: tileGeom,
          scale: 10,
          geometryType: 'polygon',
          eightConnected: false,
          reducer: ee.Reducer.mean() // This will give us the mean change magnitude
        });
        
      const deforestationFC = await evaluateFC(deforestationVectors);
      
      for (const f of (deforestationFC.features || [])) {
        const geomStr = JSON.stringify(f.geometry);
        if (!geomStr) continue;
        
        const areaHa = ee.Feature(f).geometry().area().divide(10000);
        const areaValue = await evaluateFC(ee.FeatureCollection([ee.Feature(f).set('area', areaHa)]));
        const area = areaValue.features[0]?.properties?.area || 0;
        
        // Get the change magnitude from properties
        const changeMagnitude = f.properties?.mean || 0;
        
        // Use Sequelize for database operations
        const [result] = await sequelize.query(
          `INSERT INTO "${deforestationTable}"
            (coop_id, coop_name, poly_id, pixel_id, detection_date, area_ha, change_magnitude, geom, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($8)), 4326), $9)
           RETURNING id`,
          {
            bind: [
              row.coop.coop_id,
              row.coop.coop_name,
              row.id,
              `def_${row.id}_${deforestationCount}_${month.replace(/-/g, '')}`,
              month,
              area,
              changeMagnitude,
              geomStr,
              'DETECTED' // Status: DETECTED, VERIFIED, FALSE_ALARM, etc.
            ]
          }
        );
        
        insertedFeatures.push({
          id: result[0].id,
          geometry: geomStr,
          area: area,
          change_magnitude: changeMagnitude
        });
        deforestationCount++;
      }
    }
    
    return {
      success: true,
      count: deforestationCount,
      features: insertedFeatures
    };
  } catch (err) {
    console.error(`❌ Error processing deforestation for polygon ${row.id}:`, err.message);
    return {
      success: false,
      count: 0,
      features: []
    };
  }
}

// Single table for all deforestation data
const DEFORESTATION_TABLE = 'global_deforestation_monitoring';

// ----------------- Improved Image Collection Functions -----------------
function getSentinel2Image(startDate, endDate, geometry) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) // Filter clouds
    .map(maskS2)
    .median()
    .clip(geometry);
}

// ----------------- Main Processing -----------------
async function main() {
  try {
    // Initialize Earth Engine first
    const eeInitialized = await initializeEarthEngine();
    if (!eeInitialized) {
      console.error('❌ Cannot proceed without Earth Engine initialization');
      return;
    }

    // Test database connection using Sequelize
    await sequelize.authenticate();
    console.log('✅ Sequelize connection established successfully');

    // Create global deforestation monitoring table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "${DEFORESTATION_TABLE}" (
        id SERIAL PRIMARY KEY,
        coop_id INTEGER,
        coop_name TEXT,
        poly_id INTEGER,
        pixel_id TEXT,
        detection_date DATE,
        area_ha FLOAT,
        change_magnitude FLOAT,
        geom geometry(MultiPolygon, 4326),
        status TEXT DEFAULT 'DETECTED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pixel_id, detection_date) -- Prevent duplicates
      );
    `);

    // Create global notifications table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS global_deforestation_notifications (
        id SERIAL PRIMARY KEY,
        deforestation_id INTEGER REFERENCES "${DEFORESTATION_TABLE}"(id),
        coop_id INTEGER,
        poly_id INTEGER,
        month DATE,
        message TEXT,
        change_magnitude FLOAT,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    // Create index for better performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deforestation_coop_date 
      ON "${DEFORESTATION_TABLE}" (coop_id, detection_date);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deforestation_change_magnitude 
      ON "${DEFORESTATION_TABLE}" (change_magnitude);
    `);

    // Load coop metadata for Con_Cum_Imp_WC_OVLP
    const [coops] = await sequelize.query(`
      SELECT * FROM coupe_metadata
      WHERE coupe_name = 'Con_Cum_Imp_WC_OVLP'
      LIMIT 1;
    `);

    if (coops.length === 0) {
      console.log('⚠️ No coop metadata found for Con_Cum_Imp_WC_OVLP. Exiting.');
      await sequelize.close();
      return;
    }

    console.log(`🔍 Processing ${coops.length} coops`);
    console.log(`📅 Processing ${months.length} month pairs`);

    for (const coop of coops) {
      console.log(`🏭 Processing coop: ${coop.coupe_name}`);
      
      // Load polygons from input table - using ST_AsText for better compatibility
      const [rows] = await sequelize.query(`
        SELECT id, geom, ST_AsText(geom) AS wkt_geometry
        FROM public."${coop.coupe_name}";
      `);
      
      if (rows.length === 0) {
        console.log(`⚠️ No polygons found in table: ${coop.coupe_name}`);
        continue;
      }

      console.log(`📍 Processing ${rows.length} polygons`);

      for (const monthPair of months) {
        const previousMonth = monthPair.previous;
        const currentMonth = monthPair.current;

        console.log(`\n📅 Processing period: ${previousMonth} to ${currentMonth}`);

        let totalDeforestationCount = 0;
        let processedPolygons = 0;
        let validPolygons = 0;

        for (const row of rows) {
          try {
            processedPolygons++;
            
            // Convert WKT to GeoJSON
            let geometry;
            try {
              // Parse WKT and convert to GeoJSON format
              const wkt = row.wkt_geometry;
              if (wkt && wkt.startsWith('MULTIPOLYGON')) {
                // Simple WKT to GeoJSON conversion for MultiPolygon
                const coordsText = wkt.replace('MULTIPOLYGON', '').trim();
                const polygons = coordsText.slice(2, -2).split(')),((');
                
                const coordinates = polygons.map(polygon => {
                  const rings = polygon.split('),(');
                  return rings.map(ring => {
                    const points = ring.split(',');
                    return points.map(point => {
                      const [lng, lat] = point.trim().split(' ').map(Number);
                      return [lng, lat];
                    });
                  });
                });
                
                geometry = {
                  type: 'MultiPolygon',
                  coordinates: coordinates
                };
              } else if (wkt && wkt.startsWith('POLYGON')) {
                // Simple WKT to GeoJSON conversion for Polygon
                const coordsText = wkt.replace('POLYGON', '').trim();
                const rings = coordsText.slice(2, -2).split('),(');
                
                const coordinates = rings.map(ring => {
                  const points = ring.split(',');
                  return points.map(point => {
                    const [lng, lat] = point.trim().split(' ').map(Number);
                    return [lng, lat];
                  });
                });
                
                geometry = {
                  type: 'Polygon',
                  coordinates: coordinates
                };
              } else {
                console.log(`⚠️ Unsupported WKT format for polygon ${row.id}`);
                continue;
              }
            } catch (wktError) {
              console.log(`⚠️ Error parsing WKT for polygon ${row.id}:`, wktError.message);
              continue;
            }

            const cleanedGeometry = cleanGeoJSON(geometry);
            if (!cleanedGeometry) {
              console.log(`⚠️ Skipping invalid geometry for polygon ${row.id}`);
              continue;
            }

            validPolygons++;
            const geom = ee.Geometry(cleanedGeometry);
            
            // Get previous month image (baseline)
            const previousMonthS2 = getSentinel2Image(previousMonth, currentMonth, geom);
            
            // Get current month image (for comparison)
            const nextMonth = new Date(currentMonth);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const nextMonthStr = nextMonth.toISOString().split('T')[0];
            const currentMonthS2 = getSentinel2Image(currentMonth, nextMonthStr, geom);

            // Simple check for valid imagery
            try {
              const previousInfo = await evaluateFC(ee.FeatureCollection([ee.Feature(geom).set('test', 1)]));
              const currentInfo = await evaluateFC(ee.FeatureCollection([ee.Feature(geom).set('test', 1)]));
              
              if (!previousInfo.features || !currentInfo.features) {
                console.log(`⚠️ Geometry evaluation failed for polygon ${row.id}`);
                continue;
              }
            } catch (evalError) {
              console.log(`⚠️ Geometry evaluation error for polygon ${row.id}:`, evalError.message);
              continue;
            }

            const deforestationData = detectDeforestation(previousMonthS2, currentMonthS2, geom);
            const result = await processDeforestation(DEFORESTATION_TABLE, { ...row, coop, geometry: cleanedGeometry }, deforestationData, currentMonth);

            if (result.success && result.count > 0) {
              totalDeforestationCount += result.count;
              console.log(`✅ Found ${result.count} deforestation areas in polygon ${row.id}`);
            }

            // Progress update
            if (processedPolygons % 10 === 0) {
              console.log(`📊 Processed ${processedPolygons}/${rows.length} polygons for ${currentMonth} (${validPolygons} valid)`);
            }

          } catch (err) {
            console.error(`❌ Error processing deforestation for polygon ${row.id}:`, err.message);
          }
        }

        console.log(`✅ Found ${totalDeforestationCount} deforestation areas for ${currentMonth} (processed ${validPolygons}/${rows.length} valid polygons)`);
      }
    }

    console.log('🎉 All deforestation monitoring completed successfully');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
  } finally {
    // Close connection
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the main function
main().catch(console.error);