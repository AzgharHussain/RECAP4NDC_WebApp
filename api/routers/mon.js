const ee = require('@google/earthengine');
const privatekey = require("./private-key.json");
const { sequelize } = require('../config/database');

// 2025 months from January to October
const months = [
  '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01',
  '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01',
  '2025-09-01', '2025-10-01'
];

// Generate table names for each month
const monthTables = months.map(month => {
  const monthName = new Date(month).toLocaleString('en', { month: 'short' }).toLowerCase();
  return `ndvi_${monthName}_2025`;
});

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

// ----------------- Helper Functions -----------------
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
        return coords.map(ring => cleanCoordinates(ring)).filter(ring => ring.length > 0);
      } else if (Array.isArray(coords[0])) {
        return coords.map(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return null;
          const cleanCoord = coord.slice(0, 2).filter(c => c !== null && c !== undefined);
          return cleanCoord.length === 2 ? cleanCoord : null;
        }).filter(coord => coord !== null);
      } else {
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
            if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              return [coords[0], coords[1]];
            }
            return null;
          }).filter(coord => coord !== null);
        }).filter(ring => ring.length >= 4);
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

// ----------------- NDVI Calculation -----------------
function calculateNDVI(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}

function getSentinel2Image(startDate, endDate, geometry) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2)
    .median()
    .clip(geometry);
}

// ----------------- Create Monthly Tables -----------------
async function createMonthlyTables() {
  console.log('🗃️ Creating monthly NDVI tables...');

  for (let i = 0; i < months.length; i++) {
    const tableName = monthTables[i];
    const monthDate = months[i];

    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          coop_id INTEGER,
          coop_name TEXT,
          poly_id INTEGER,
          pixel_id TEXT,
          month_date DATE,
          ndvi_value FLOAT,
          area_ha FLOAT,
          geom geometry(Point, 4326),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(pixel_id, month_date)
        );

        CREATE INDEX IF NOT EXISTS idx_${tableName}_coop_id ON "${tableName}"(coop_id);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_poly_id ON "${tableName}"(poly_id);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_month_date ON "${tableName}"(month_date);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_geom ON "${tableName}" USING GIST(geom);
      `);

      console.log(`✅ Created table: ${tableName} for ${monthDate}`);
    } catch (error) {
      console.error(`❌ Error creating table ${tableName}:`, error.message);
    }
  }
}

// ----------------- Pixel-wise NDVI Processing -----------------
async function processNDVIPixels(ndviTable, row, ndviImage, month, scale = 10) {
  try {
    const geom = ee.Geometry(row.geometry);

    // Sample NDVI values at pixel level (10m scale)
    const ndviSamples = ndviImage.sample({
      region: geom,
      scale: scale,
      geometries: true,
      tileScale: 1
    });

    const ndviFC = await evaluateFC(ndviSamples);

    let pixelCount = 0;
    let insertedPixels = [];

    if (!ndviFC || !ndviFC.features || !Array.isArray(ndviFC.features)) {
      console.log(`⚠️ No NDVI pixels found for polygon ${row.id}`);
      return {
        success: true,
        count: 0,
        pixels: []
      };
    }

    console.log(`🔍 Found ${ndviFC.features.length} NDVI pixels for polygon ${row.id}`);

    for (let i = 0; i < ndviFC.features.length; i++) {
      const pixel = ndviFC.features[i];

      if (!pixel || !pixel.geometry) {
        console.log(`⚠️ Skipping pixel ${i} - no geometry`);
        continue;
      }

      try {
        const ndviValue = pixel.properties?.NDVI;

        if (ndviValue === null || ndviValue === undefined) {
          console.log(`⚠️ Skipping pixel ${i} - no NDVI value`);
          continue;
        }

        // Validate NDVI range
        if (ndviValue < -1 || ndviValue > 1) {
          console.log(`⚠️ Skipping pixel ${i} - invalid NDVI value: ${ndviValue}`);
          continue;
        }

        const geomStr = JSON.stringify(pixel.geometry);
        if (!geomStr || geomStr === '{}' || geomStr === 'null') {
          console.log(`⚠️ Skipping pixel ${i} - invalid geometry`);
          continue;
        }

        // Calculate pixel area (10m x 10m = 0.0001 ha)
        const pixelArea = 0.0001;

        // Generate unique pixel ID
        const pixelId = `ndvi_${row.id}_${pixelCount}_${month.replace(/-/g, '')}_${Date.now()}`;

        // Insert into the specific month's NDVI table
        const [result] = await sequelize.query(
          `INSERT INTO "${ndviTable}"
            (coop_id, coop_name, poly_id, pixel_id, month_date, ndvi_value, area_ha, geom, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_GeomFromGeoJSON($8), 4326), NOW())
           ON CONFLICT (pixel_id, month_date) DO NOTHING
           RETURNING id`,
          {
            bind: [
              row.coop?.coupe_code || 0,
              row.coop?.coupe_name || 'unknown',
              row.id,
              pixelId,
              month,
              parseFloat(ndviValue.toFixed(6)),
              pixelArea,
              geomStr
            ]
          }
        );

        if (result && result.length > 0) {
          insertedPixels.push({
            id: result[0].id,
            geometry: geomStr,
            ndvi_value: ndviValue,
            area: pixelArea
          });
          pixelCount++;

          if (pixelCount % 100 === 0) {
            console.log(`✅ Inserted ${pixelCount} NDVI pixels for polygon ${row.id}`);
          }
        }

      } catch (pixelError) {
        console.error(`❌ Error processing NDVI pixel ${i}:`, pixelError.message);
        continue;
      }
    }

    console.log(`✅ Processed ${pixelCount}/${ndviFC.features.length} valid NDVI pixels for polygon ${row.id}`);

    return {
      success: true,
      count: pixelCount,
      pixels: insertedPixels
    };

  } catch (err) {
    console.error(`❌ Error processing NDVI pixels for polygon ${row.id}:`, err.message);
    return {
      success: false,
      count: 0,
      pixels: []
    };
  }
}

// ----------------- Validation Function -----------------
async function validateImageAvailability(dateRange, geometry) {
  try {
    const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(dateRange.start, dateRange.end)
      .filterBounds(geometry)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80));

    const count = collection.size();
    const countValue = await evaluateFC(ee.FeatureCollection([ee.Feature(geometry).set('count', count)]));

    return countValue.features[0]?.properties?.count > 0;
  } catch (error) {
    return false;
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

    // Create monthly tables
    await createMonthlyTables();

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
    console.log(`📅 Processing ${months.length} months`);

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

      // Process only a subset for testing (remove slice for full processing)
      const sampleRows = rows.slice(0, 5);

      // Process each month separately
      for (let monthIndex = 0; monthIndex < months.length; monthIndex++) {
        const month = months[monthIndex];
        const tableName = monthTables[monthIndex];

        console.log(`\n📅 Processing month: ${month} into table: ${tableName}`);

        const nextMonth = new Date(month);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthStr = nextMonth.toISOString().split('T')[0];

        let totalPixelCount = 0;
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

            // Validate image availability for this month
            const hasImages = await validateImageAvailability(
              { start: month, end: nextMonthStr },
              cleanedGeometry
            );

            if (!hasImages) {
              console.log(`⚠️ No Sentinel-2 images available for polygon ${row.id} in ${month}`);
              continue;
            }

            // Get and process NDVI image
            const s2Image = getSentinel2Image(month, nextMonthStr, cleanedGeometry);
            const ndviImage = calculateNDVI(s2Image);

            // Process NDVI pixels for this specific month table
            const result = await processNDVIPixels(
              tableName,
              { ...row, geometry: cleanedGeometry, coop },
              ndviImage,
              month
            );

            if (result.success) {
              totalPixelCount += result.count;
              console.log(`✅ Added ${result.count} pixels for polygon ${row.id} in ${tableName}`);
            }

          } catch (error) {
            console.error(`❌ Error processing polygon ${row.id} for month ${month}:`, error.message);
            continue;
          }
        }

        console.log(`\n📊 Month ${month} Summary:`);
        console.log(`   - Table: ${tableName}`);
        console.log(`   - Processed polygons: ${processedPolygons}`);
        console.log(`   - Valid polygons: ${validPolygons}`);
        console.log(`   - Total pixels inserted: ${totalPixelCount}`);
      }
    }

    console.log('\n🎉 All monthly NDVI processing completed!');
    console.log('📋 Tables created:');
    monthTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table} (${months[index]})`);
    });

    await sequelize.close();

  } catch (error) {
    console.error('❌ Fatal error in main process:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

// Execute main function
main().catch(console.error);
