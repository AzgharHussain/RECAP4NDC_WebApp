const ee = require('@google/earthengine');
const privatekey = require("./private-key.json");
const { sequelize } = require('../config/database');

var months = [
  {current: '2025-04-01', previous: '2020-12-01'},
  {current: '2025-08-01', previous: '2025-04-01'}
  // {current: '2025-03-01', previous: '2025-02-01'},
  // {current: '2025-04-01', previous: '2025-03-01'},
  // {current: '2025-05-01', previous: '2025-04-01'},
  // {current: '2025-06-01', previous: '2025-05-01'},
  // {current: '2025-07-01', previous: '2025-06-01'},
  // {current: '2025-08-01', previous: '2025-07-01'},
  // {current: '2025-09-01', previous: '2025-08-01'},
  // {current: '2025-10-01', previous: '2025-09-01'}
];

// ----------------- Earth Engine Authentication -----------------
async function initializeEarthEngine() {
  try {
    await ee.data.authenticateViaPrivateKey(privatekey);
    await ee.initialize(null, null, () => {
      console.log('✅ Earth Engine initialized successfully');
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Earth Engine:', error.message);
    return false;
  }
}

// ----------------- Improved Helper Functions -----------------
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

function cleanAndValidateGeometry(geometry) {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  try {
    const cleanCoordinates = (coords) => {
      if (!Array.isArray(coords)) return [];
      
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        // Nested array (polygon or multipolygon rings)
        return coords.map(ring => cleanCoordinates(ring)).filter(ring => ring.length > 0);
      } else if (Array.isArray(coords[0])) {
        // Array of coordinates
        return coords.map(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return null;
          
          // Filter out null values and ensure we have at least 2 coordinates
          const cleanCoord = coord.slice(0, 2).filter(c => c !== null && c !== undefined);
          return cleanCoord.length === 2 ? cleanCoord : null;
        }).filter(coord => coord !== null);
      } else {
        // Single coordinate
        const cleanCoord = coords.slice(0, 2).filter(c => c !== null && c !== undefined);
        return cleanCoord.length === 2 ? cleanCoord : null;
      }
    };

    const cleaned = JSON.parse(JSON.stringify(geometry));
    
    if (cleaned.type === 'MultiPolygon') {
      cleaned.coordinates = cleaned.coordinates.map(polygon => 
        cleanCoordinates(polygon)
      ).filter(polygon => polygon.length > 0 && polygon[0].length >= 4);
    } else if (cleaned.type === 'Polygon') {
      cleaned.coordinates = cleanCoordinates(cleaned.coordinates);
    }

    // Final validation
    if (!cleaned.coordinates || cleaned.coordinates.length === 0) {
      return null;
    }

    return cleaned;
  } catch (error) {
    console.error('❌ Error cleaning geometry:', error.message);
    return null;
  }
}

function wktToGeoJSON(wkt) {
  if (!wkt) return null;
  
  try {
    if (wkt.startsWith('MULTIPOLYGON')) {
      const coordsText = wkt.replace('MULTIPOLYGON', '').trim();
      const polygons = coordsText.slice(2, -2).split(')),((');
      
      const coordinates = polygons.map(polygon => {
        const rings = polygon.split('),(');
        return rings.map(ring => {
          const points = ring.split(',');
          return points.map(point => {
            const coords = point.trim().split(' ').map(Number);
            // Filter out invalid coordinates
            if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              return [coords[0], coords[1]];
            }
            return null;
          }).filter(coord => coord !== null);
        }).filter(ring => ring.length >= 4); // Minimum 4 points for a ring
      }).filter(polygon => polygon.length > 0);
      
      return coordinates.length > 0 ? {
        type: 'MultiPolygon',
        coordinates: coordinates
      } : null;
      
    } else if (wkt.startsWith('POLYGON')) {
      const coordsText = wkt.replace('POLYGON', '').trim();
      const rings = coordsText.slice(2, -2).split('),(');
      
      const coordinates = rings.map(ring => {
        const points = ring.split(',');
        return points.map(point => {
          const coords = point.trim().split(' ').map(Number);
          if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            return [coords[0], coords[1]];
          }
          return null;
        }).filter(coord => coord !== null);
      }).filter(ring => ring.length >= 4);
      
      return coordinates.length > 0 ? {
        type: 'Polygon',
        coordinates: coordinates
      } : null;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error converting WKT to GeoJSON:', error.message);
    return null;
  }
}

// ----------------- Improved Deforestation Detection -----------------
function detectDeforestation(previousMonthImage, currentMonthImage, geometry) {
  try {
    // Calculate NDVI for both periods
    const ndviPrevious = previousMonthImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
    const ndviCurrent = currentMonthImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
    
    // Calculate NDVI change
    const ndviChange = ndviCurrent.subtract(ndviPrevious);
    
    // Define forest threshold (adjust based on your region)
    const forestThreshold = 0.3; // Increased threshold for better detection
    
    // Identify areas that were forest
    const wasForest = ndviPrevious.gt(forestThreshold);
    
    // Detect significant negative changes (deforestation)
    const significantNegativeChange = ndviChange.lt(-0.1); // More sensitive threshold
    
    // Deforestation = was forest AND has significant negative change
    const deforestation = wasForest.and(significantNegativeChange);
    
    return {
      deforestation: deforestation.rename('deforestation'),
      ndviPrevious,
      ndviCurrent,
      ndviChange,
      changeMagnitude: ndviChange.multiply(-1).rename('change_magnitude'),
      geometry
    };
  } catch (error) {
    console.error('❌ Error in deforestation detection:', error.message);
    throw error;
  }
}

// ----------------- Improved Deforestation Feature Processing -----------------
async function processDeforestationSimple(deforestationTable, row, deforestationData, month) {
  try {
    const geom = ee.Geometry(row.geometry);
    
    // Get deforestation areas with change magnitude
    const deforestationWithChange = deforestationData.deforestation
      .updateMask(deforestationData.deforestation)
      .addBands(deforestationData.changeMagnitude);
    
    // Convert to vectors at a reasonable scale
    const deforestationVectors = deforestationWithChange
      .reduceToVectors({
        geometry: geom,
        scale: 30,
        geometryType: 'polygon',
        eightConnected: false,
        reducer: ee.Reducer.mean(),
        maxPixels: 1e8
      });
    
    const deforestationFC = await evaluateFC(deforestationVectors);
    
    let deforestationCount = 0;
    let insertedFeatures = [];
    
    // Check if we have valid features
    if (!deforestationFC || !deforestationFC.features || !Array.isArray(deforestationFC.features)) {
      console.log(`⚠️ No deforestation features found for polygon ${row.id}`);
      return {
        success: true,
        count: 0,
        features: []
      };
    }
    
    console.log(`🔍 Found ${deforestationFC.features.length} potential deforestation features for polygon ${row.id}`);
    
    for (let i = 0; i < deforestationFC.features.length; i++) {
      const f = deforestationFC.features[i];
      
      // Validate feature exists and has geometry
      if (!f || !f.geometry) {
        console.log(`⚠️ Skipping feature ${i} - no geometry`);
        continue;
      }
      
      try {
        // Validate and stringify geometry
        const geomStr = JSON.stringify(f.geometry);
        if (!geomStr || geomStr === '{}' || geomStr === 'null') {
          console.log(`⚠️ Skipping feature ${i} - invalid geometry`);
          continue;
        }
        
        // Calculate area with proper error handling
        let area = 0;
        try {
          const areaHa = ee.Feature(f).geometry().area().divide(10000);
          const areaValue = await evaluateFC(ee.FeatureCollection([ee.Feature(f).set('area', areaHa)]));
          area = areaValue.features?.[0]?.properties?.area || 0;
        } catch (areaError) {
          console.log(`⚠️ Area calculation error for feature ${i}:`, areaError.message);
          // Estimate area from bounding box as fallback
          const coords = f.geometry.coordinates;
          if (coords && coords.length > 0) {
            // Simple area estimation (very rough)
            area = coords.flat().length * 0.0001; // Rough estimate
          }
        }
        
        // Skip very small areas (likely noise)
        if (area < 0.01) {
          console.log(`⚠️ Skipping feature ${i} - area too small: ${area} ha`);
          continue;
        }
        
        // Get the change magnitude with fallback
        const changeMagnitude = f.properties?.mean || f.properties?.change_magnitude || 0;
        
        // Generate unique pixel ID
        const pixelId = `def_${row.id}_${deforestationCount}_${month.replace(/-/g, '')}_${Date.now()}`;
        
        // Insert into database
        const [result] = await sequelize.query(
          `INSERT INTO "${deforestationTable}"
            (coop_id, coop_name, poly_id, pixel_id, detection_date, area_ha, change_magnitude, geom, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($8)), 4326), $9)
           ON CONFLICT (pixel_id, detection_date) DO NOTHING
           RETURNING id`,
          {
            bind: [
              row.coop?.coop_id || 0,
              row.coop?.coop_name || 'unknown',
              row.id,
              pixelId,
              month,
              parseFloat(area.toFixed(6)),
              parseFloat(changeMagnitude.toFixed(6)),
              geomStr,
              'DETECTED'
            ]
          }
        );
        
        if (result && result.length > 0) {
          insertedFeatures.push({
            id: result[0].id,
            geometry: geomStr,
            area: area,
            change_magnitude: changeMagnitude
          });
          deforestationCount++;
          console.log(`✅ Inserted deforestation feature ${i} for polygon ${row.id}, area: ${area.toFixed(4)} ha`);
        } else {
          console.log(`⚠️ Feature ${i} not inserted (possible duplicate)`);
        }
        
      } catch (featureError) {
        console.error(`❌ Error processing deforestation feature ${i}:`, featureError.message);
        // Log the feature for debugging
        console.log(`   Feature details:`, {
          hasGeometry: !!f.geometry,
          hasProperties: !!f.properties,
          properties: f.properties
        });
        continue;
      }
    }
    
    console.log(`✅ Processed ${deforestationCount}/${deforestationFC.features.length} valid deforestation features for polygon ${row.id}`);
    
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

// ----------------- Improved Image Collection -----------------
function getSentinel2Image(startDate, endDate, geometry) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) // Stricter cloud filter
    .map(maskS2)
    .median()
    .clip(geometry);
}

// ----------------- Validation Functions -----------------
async function validateImageAvailability(dateRange, geometry) {
  try {
    const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(dateRange.start, dateRange.end)
      .filterBounds(geometry)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));
    
    const count = collection.size();
    const countValue = await evaluateFC(ee.FeatureCollection([ee.Feature(geometry).set('count', count)]));
    
    return countValue.features[0]?.properties?.count > 0;
  } catch (error) {
    return false;
  }
}

// ----------------- Debug Function -----------------
async function debugDeforestationFeatures(deforestationFC, polygonId) {
  console.log(`🐛 DEBUG Polygon ${polygonId}:`);
  console.log(`   Features array:`, Array.isArray(deforestationFC.features));
  console.log(`   Number of features:`, deforestationFC.features?.length || 0);
  
  if (deforestationFC.features && deforestationFC.features.length > 0) {
    const firstFeature = deforestationFC.features[0];
    console.log(`   First feature:`, {
      hasGeometry: !!firstFeature.geometry,
      geometryType: firstFeature.geometry?.type,
      hasProperties: !!firstFeature.properties,
      properties: firstFeature.properties
    });
  }
}

// ----------------- Main Processing -----------------
async function main() {
  try {
    // Initialize Earth Engine
    const eeInitialized = await initializeEarthEngine();
    if (!eeInitialized) {
      console.error('❌ Cannot proceed without Earth Engine initialization');
      return;
    }

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Sequelize connection established successfully');

    // Create tables if not exists
    const DEFORESTATION_TABLE = 'global_deforestation_monitoring';
    
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
        UNIQUE(pixel_id, detection_date)
      );
    `);

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

    // Load coop metadata
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
      
      // Load polygons
      const [rows] = await sequelize.query(`
        SELECT id, geom, ST_AsText(geom) AS wkt_geometry
        FROM public."${coop.coupe_name}";
      `);
      
      if (rows.length === 0) {
        console.log(`⚠️ No polygons found in table: ${coop.coupe_name}`);
        continue;
      }

      console.log(`📍 Processing ${rows.length} polygons`);

      // Process only a subset for testing
      const sampleRows = rows.slice(0, 10); // Process only first 10 polygons for testing
      
      for (const monthPair of months.slice(0, 2)) { // Process only first 2 months for testing
        const previousMonth = monthPair.previous;
        const currentMonth = monthPair.current;

        console.log(`\n📅 Processing period: ${previousMonth} to ${currentMonth}`);

        let totalDeforestationCount = 0;
        let processedPolygons = 0;
        let validPolygons = 0;

        for (const row of sampleRows) {
          try {
            processedPolygons++;
            
            // Convert WKT to GeoJSON
            const geometry = wktToGeoJSON(row.wkt_geometry);
            if (!geometry) {
              console.log(`⚠️ Invalid WKT geometry for polygon ${row.id}`);
              continue;
            }

            // Clean and validate geometry
            const cleanedGeometry = cleanAndValidateGeometry(geometry);
            if (!cleanedGeometry) {
              console.log(`⚠️ Invalid geometry after cleaning for polygon ${row.id}`);
              continue;
            }

            validPolygons++;
            
            console.log(`🔍 Processing polygon ${row.id} with ${cleanedGeometry.coordinates?.length || 0} polygons`);

            // Get images with better error handling
            let previousMonthS2, currentMonthS2;
            try {
              const geom = ee.Geometry(cleanedGeometry);
              
              previousMonthS2 = getSentinel2Image(previousMonth, currentMonth, geom);
              const nextMonth = new Date(currentMonth);
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              const nextMonthStr = nextMonth.toISOString().split('T')[0];
              currentMonthS2 = getSentinel2Image(currentMonth, nextMonthStr, geom);

              // Validate images
              const previousValid = await validateImageAvailability(
                { start: previousMonth, end: currentMonth }, 
                geom
              );
              const currentValid = await validateImageAvailability(
                { start: currentMonth, end: nextMonthStr }, 
                geom
              );
              
              if (!previousValid || !currentValid) {
                console.log(`⚠️ No valid imagery for polygon ${row.id}`);
                continue;
              }

              // Detect deforestation
              const deforestationData = detectDeforestation(previousMonthS2, currentMonthS2, geom);
              const result = await processDeforestationSimple(
                DEFORESTATION_TABLE, 
                { ...row, coop, geometry: cleanedGeometry }, 
                deforestationData, 
                currentMonth
              );

              if (result.success) {
                totalDeforestationCount += result.count;
                if (result.count > 0) {
                  console.log(`✅ Found ${result.count} deforestation areas in polygon ${row.id}`);
                  
                  // Log notifications
                  for (const feature of result.features) {
                    const message = `Deforestation detected in polygon ${row.id} for ${currentMonth}. Area: ${feature.area.toFixed(4)} ha. NDVI change: -${feature.change_magnitude.toFixed(6)}`;
                    
                    await sequelize.query(
                      `INSERT INTO global_deforestation_notifications
                        (deforestation_id, coop_id, poly_id, month, message, change_magnitude, status, created_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                      {
                        bind: [feature.id, coop.coop_id, row.id, currentMonth, message, feature.change_magnitude, 'PENDING']
                      }
                    );
                  }
                } else {
                  console.log(`ℹ️ No deforestation detected in polygon ${row.id}`);
                }
              }

            } catch (imageError) {
              console.error(`❌ Image processing error for polygon ${row.id}:`, imageError.message);
              continue;
            }

            // Progress update
            console.log(`📊 Processed ${processedPolygons}/${sampleRows.length} polygons for ${currentMonth}`);

          } catch (err) {
            console.error(`❌ General error processing polygon ${row.id}:`, err.message);
            console.error(`   Stack:`, err.stack);
          }
        }

        console.log(`✅ Found ${totalDeforestationCount} deforestation areas for ${currentMonth} (processed ${validPolygons}/${sampleRows.length} valid polygons)`);
      }
    }

    // Display summary
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_detections,
        AVG(change_magnitude) as avg_change,
        MIN(change_magnitude) as min_change,
        MAX(change_magnitude) as max_change
      FROM "${DEFORESTATION_TABLE}"
    `);

    console.log('\n📊 Deforestation Monitoring Summary:');
    console.log(`   Total detections: ${summary[0].total_detections}`);
    console.log(`   Average NDVI change: ${summary[0].avg_change}`);
    console.log(`   Min NDVI change: ${summary[0].min_change}`);
    console.log(`   Max NDVI change: ${summary[0].max_change}`);

    console.log('🎉 All deforestation monitoring completed successfully');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the main function
main().catch(console.error);