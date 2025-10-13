const express = require('express');
const { Client } = require('pg');
const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Initialize Express and multer for file uploads
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

// PostgreSQL Configuration
const pgClient = new Client({
  user: "postgres",
  host: "68.178.167.39",
  database: "Recap4NDC",
  password: "DB@$ecure#25",
  port: 5432,
});

// GeoServer Configuration
const GEOSERVER_URL = "https://gisfy.co.in:8443/geoserver/rest";
const WORKSPACE = "cite";
const DATASTORE = "Recap4NDC_DB";
const GEOSERVER_USER = "admin";
const GEOSERVER_PASS = "geoserver";

// Express API endpoint to handle Shapefile upload and processing
app.post('/uploadShapefile', upload.single('shapefile'), async (req, res) => {
  const { filename, path: filePath } = req.file;
  const coupeName = req.body.coupeName;

  if (!coupeName) {
    return res.status(400).send("Coupe name is required.");
  }

  try {
    await pgClient.connect();
    console.log("✅ Connected to PostgreSQL");

    // Step 1: Unzip and Extract Shapefile
    const shapefilePath = await unzipShapefile(filePath);

    // Step 2: Process the Shapefile Data and Create Table
    await createTableForCoupe(coupeName);
    const shapefileData = await extractShapefileData(shapefilePath, coupeName);

    // Step 3: Insert Data into Table
    await insertShapefileDataToTable(coupeName, shapefileData);

    // Step 4: Publish to GeoServer using the new method
    const tableName = coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
    const styleName = "Arvalli_Coupe";
    
    console.log(`🌍 Publishing layer to GeoServer: ${tableName}`);
    await publishLayerWithStyle(tableName, styleName, tableName);

    // Step 5: Insert Into beatview_metadata
    await insertIntoBeatviewMetadata(1, coupeName, tableName);

    res.status(200).json({ 
      success: true, 
      message: "Shapefile processed successfully.",
      tableName: tableName
    });
  } catch (err) {
    console.error("💥 Fatal error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred during processing.",
      error: err.message 
    });
  } finally {
    await pgClient.end();
    console.log("\n🔚 PostgreSQL connection closed.");
  }
});

// Helper Functions

// Unzip the uploaded Shapefile
async function unzipShapefile(filePath) {
  const unzipDir = path.join('uploads', 'shapefiles');
  if (!fs.existsSync(unzipDir)) {
    fs.mkdirSync(unzipDir, { recursive: true });
  }

  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    let shpFile, dbfFile, shxFile, prjFile;

    zipEntries.forEach(function(zipEntry) {
      const entryName = zipEntry.entryName;
      const fileName = path.basename(entryName);
      const outputPath = path.join(unzipDir, fileName);
      
      if (entryName.endsWith('.shp')) {
        shpFile = outputPath;
      } else if (entryName.endsWith('.dbf')) {
        dbfFile = outputPath;
      } else if (entryName.endsWith('.shx')) {
        shxFile = outputPath;
      } else if (entryName.endsWith('.prj')) {
        prjFile = outputPath;
      }
      
      if (entryName.endsWith('.shp') || entryName.endsWith('.shx') || entryName.endsWith('.dbf') || entryName.endsWith('.prj')) {
        zip.extractEntryTo(zipEntry, unzipDir, false, true);
      }
    });

    // Check if essential files exist
    if (!shpFile || !fs.existsSync(shpFile)) {
      throw new Error('Shapefile (.shp) not found in zip');
    }
    if (!dbfFile || !fs.existsSync(dbfFile)) {
      throw new Error('DBF file (.dbf) not found in zip');
    }

    return {
      shp: shpFile,
      dbf: dbfFile,
      shx: shxFile,
      prj: prjFile
    };
  } catch (err) {
    console.error('Error unzipping shapefile:', err);
    throw err;
  }
}

// Function to extract shapefile data
async function extractShapefileData(shapefilePath, coupeName) {
  const shapefileData = [];
  
  try {
    console.log(`🔧 Processing shapefile for coupe: ${coupeName}`);
    
    const source = await shapefile.open(shapefilePath.shp, shapefilePath.dbf, { encoding: 'utf-8' });
    
    let result = await source.read();
    while (!result.done) {
      shapefileData.push(result.value);
      result = await source.read();
    }
    
    console.log(`✅ Shapefile data extracted successfully. Found ${shapefileData.length} features.`);
    return shapefileData;
  } catch (err) {
    console.error(`❌ Error reading shapefile: ${err.message}`);
    throw new Error(`Error extracting shapefile: ${err.message}`);
  }
}

// Function to create table for the Shapefile data
async function createTableForCoupe(coupeName) {
  const tableName = coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
  
  // Drop table if exists to ensure clean state
  const dropTableSQL = `DROP TABLE IF EXISTS "${tableName}"`;
  await pgClient.query(dropTableSQL);
  
  // Create table with proper geometry column
  const createTableSQL = `
    CREATE TABLE "${tableName}" (
      id SERIAL PRIMARY KEY,
      geom GEOMETRY(POLYGON, 4326),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create spatial index for better performance
    CREATE INDEX "${tableName}_geom_idx" ON "${tableName}" USING GIST (geom);
  `;
  
  try {
    await pgClient.query(createTableSQL);
    console.log(`✅ Table "${tableName}" created successfully with spatial index.`);
  } catch (err) {
    console.error(`❌ Error creating table "${tableName}": ${err.message}`);
    throw err;
  }
}

// Function to insert shapefile data into the new table
async function insertShapefileDataToTable(coupeName, shapefileData) {
  const tableName = coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < shapefileData.length; i++) {
    const data = shapefileData[i];
    
    try {
      const geom = data.geometry;
      if (!geom || !geom.coordinates || geom.coordinates.length === 0) {
        console.log(`❌ Invalid geometry found for record ${i}`);
        errorCount++;
        continue;
      }

      // Insert with explicit SRID
      const insertSQL = `
        INSERT INTO "${tableName}" (geom) 
        VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
      `;
      
      await pgClient.query(insertSQL, [JSON.stringify(geom)]);
      successCount++;

    } catch (err) {
      console.error(`❌ Error inserting geometry at index ${i}: ${err.message}`);
      errorCount++;
    }
  }
  console.log(`✅ Data insertion completed: ${successCount} successful, ${errorCount} failed for "${tableName}".`);
}

// ---- Check if Style Exists ----
async function checkStyleExists(styleName) {
  const url = `${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}.json`;
 
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": "Basic " + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
      },
    });
 
    if (res.ok) {
      console.log(`✅ Style "${styleName}" found in GeoServer`);
      return true;
    } else if (res.status === 404) {
      console.log(`ℹ️ Style "${styleName}" not found in workspace "${WORKSPACE}" - will use default style`);
      return false;
    } else {
      const errText = await res.text();
      console.error(`❌ Error checking style "${styleName}":`, errText);
      return false;
    }
  } catch (err) {
    console.error(`❌ Failed to check style "${styleName}":`, err.message);
    return false;
  }
}
 
// ---- Publish Layer with Style (or without if style is missing) ----
async function publishLayerWithStyle(tableName, styleName, dbTableName) {
  // Check style first, but don't stop if style is missing
  const styleExists = await checkStyleExists(styleName);
  
  const url = `${GEOSERVER_URL}/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`;
 
  // Create request body - include style only if it exists
  const body = {
    featureType: {
      name: tableName,
      nativeName: dbTableName,
      title: tableName,
      srs: "EPSG:4326",
      enabled: true,
      // Only include defaultStyle if the style exists
      ...(styleExists && { defaultStyle: { name: styleName } })
    },
  };
 
  try {
    if (styleExists) {
      console.log(`📤 Publishing layer "${tableName}" to GeoServer with style "${styleName}"...`);
    } else {
      console.log(`📤 Publishing layer "${tableName}" to GeoServer without specific style (will use default)...`);
    }
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Basic " + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
      },
      body: JSON.stringify(body),
    });
 
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) {
        console.error(`❌ Unauthorized: check GeoServer username/password`);
      } else if (res.status === 500 && errText.includes("already exists")) {
        console.log(`⚠️ Layer "${tableName}" already published, continuing.`);
        return true;
      } else {
        console.error(`❌ Failed to publish "${tableName}":`, errText);
        return false;
      }
    } else {
      if (styleExists) {
        console.log(`✅ Successfully published layer: "${tableName}" with style "${styleName}"`);
      } else {
        console.log(`✅ Successfully published layer: "${tableName}" without specific style (using default)`);
      }
      return true;
    }
  } catch (err) {
    console.error(`❌ Error publishing "${tableName}":`, err.message);
    console.error(`🔍 Check if GeoServer is running and accessible at: ${GEOSERVER_URL}`);
    return false;
  }
}

// Function to insert into `beatview_metadata` table with conflict resolution
async function insertIntoBeatviewMetadata(beatId, viewName, tableName) {
  const insertSQL = `
    INSERT INTO public.beatview_metadata (beat_id, beat_name, input_table_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (beat_id) DO NOTHING;
  `;
  await pgClient.query(insertSQL, [beatId, viewName, tableName]);
  console.log(`✅ Inserted into beatview_metadata for ${viewName}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test GeoServer connectivity endpoint
app.get('/test-geoserver', async (req, res) => {
  try {
    console.log('Testing GeoServer connectivity...');
    
    // Test basic REST access
    const aboutUrl = `${GEOSERVER_URL}/about/version.json`;
    const aboutResponse = await fetch(aboutUrl, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
        "Accept": "application/json"
      }
    });
    
    if (aboutResponse.ok) {
      console.log('✅ GeoServer REST API accessible');
    } else {
      throw new Error(`GeoServer access failed: ${aboutResponse.status}`);
    }
    
    // Test datastore access
    const datastoreUrl = `${GEOSERVER_URL}/workspaces/${WORKSPACE}/datastores/${DATASTORE}.json`;
    const datastoreResponse = await fetch(datastoreUrl, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
        "Accept": "application/json"
      }
    });
    
    if (datastoreResponse.ok) {
      console.log('✅ GeoServer datastore accessible');
    } else {
      throw new Error(`Datastore access failed: ${datastoreResponse.status}`);
    }
    
    // Test style exists (but don't fail if it doesn't)
    const styleName = "Arvalli_Coupe";
    const styleExists = await checkStyleExists(styleName);
    
    res.status(200).json({
      status: 'SUCCESS',
      geoserver: 'Accessible',
      datastore: 'Accessible',
      style: styleExists ? 'Exists' : 'Not Found (will use default)',
      version: 'Connected'
    });
  } catch (error) {
    console.error('❌ GeoServer test failed:', error.message);
    
    res.status(500).json({
      status: 'FAILED',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:5000`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🔗 Test GeoServer: http://localhost:${PORT}/test-geoserver`);
  console.log(`🌍 GeoServer URL: ${GEOSERVER_URL}`);
});