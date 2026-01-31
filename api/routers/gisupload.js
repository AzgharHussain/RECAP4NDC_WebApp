const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const { verifyJwt } = require("../middlewares/verifyJwt"); 

const router = express.Router();

const { sequelize, testConnection } = require('../config/ndvidatabase');

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- DB & GEOSERVER CONFIG ---
const PG_HOST = "68.178.167.216";
const PG_USER = "postgres";
const PG_PASS = "P$DB@25%$#!26";
const PG_DB = "Recap4NDC_new";

const GEOSERVER_URL = "http://68.178.167.216:8081/geoserver";
const GEOSERVER_USER = "admin";
const GEOSERVER_PASS = "geoserver";
const WORKSPACE = "Recap4NDC";
const DATASTORE = "Recap4NDC_New";
// --------------------------------

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// --- Utility: Run shell commands ---
// --- Utility: Run shell commands with GDAL path ---
function runCommand(cmd, env = process.env) {
  // Add GDAL to PATH for this command
  const updatedEnv = {
    ...env,
    PATH: `${env.PATH};C:\\GisfyProject\\RECAP_OSGEO\\OSGeo4W\\bin`,
    GDAL_DATA: "C:\\GisfyProject\\RECAP_OSGEO\\OSGeo4W\\share\\gdal",
    PROJ_LIB: "C:\\GisfyProject\\RECAP_OSGEO\\OSGeo4W\\share\\proj"
  };
  
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, env: updatedEnv }, (err, stdout, stderr) => {
      if (err) {
        // For GDAL warnings that aren't fatal
        if (stderr && (
          stderr.includes("WARNING") || 
          stderr.includes("Warning") ||
          stderr.includes("warning")
        )) {
          console.warn("Command warning:", stderr.substring(0, 500));
          return resolve({ stdout, stderr });
        }
        return reject({ err, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}

// --- Test GDAL Connection ---
async function testGDALConnection() {
  try {
    console.log("Testing GDAL installation...");
    console.log("System PATH:", process.env.PATH);
    
    // Try multiple ways to find GDAL
    const gdalPaths = [
      "C:\\GisfyProject\\RECAP_OSGEO\\OSGeo4W\\bin\\ogr2ogr.exe",
      "ogr2ogr.exe",
      "ogr2ogr"
    ];
    
    for (const gdalPath of gdalPaths) {
      try {
        console.log(`Trying: ${gdalPath}`);
        const { stdout } = await runCommand(`"${gdalPath}" --version`);
        console.log(`✓ GDAL Found: ${stdout.trim()}`);
        console.log(`✓ Using: ${gdalPath}`);
        return true;
      } catch (error) {
        console.log(`✗ Not found: ${gdalPath}`);
      }
    }
    
    console.error("✗ GDAL not found in any location");
    return false;
  } catch (error) {
    console.error("✗ GDAL test error:", error.message);
    return false;
  }
}

// --- Generate SLD for GeoServer styling ---
function generateSLD(layerName, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <NamedLayer>
    <Name>${WORKSPACE}:${layerName}</Name>
    <UserStyle>
      <Title>${layerName} Boundary Style</Title>

      <FeatureTypeStyle>
        <Rule>

          <!-- Polygon Boundary Only -->
          <PolygonSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
              <CssParameter name="stroke-opacity">1.0</CssParameter>
            </Stroke>
          </PolygonSymbolizer>

          <!-- Line Boundary -->
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
              <CssParameter name="stroke-opacity">1.0</CssParameter>
            </Stroke>
          </LineSymbolizer>

          <!-- Point Boundary Only -->
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill-opacity">0</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">${color}</CssParameter>
                  <CssParameter name="stroke-width">2</CssParameter>
                  <CssParameter name="stroke-opacity">1.0</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>

        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
}

// --- Fix PostgreSQL table for GeoServer ---
async function fixPostgreSQLTable(tableName) {
  try {
    const env = { ...process.env, PGPASSWORD: PG_PASS };
    const lowerTable = tableName.toLowerCase();

    console.log(`Fixing PostgreSQL table: ${lowerTable}`);

    // Check if fid exists; only create if missing
    const checkFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='fid';"`;
    const { stdout } = await runCommand(checkFidCmd, env);

    if (!stdout.trim()) {
      console.log(`Adding fid column to ${lowerTable}...`);
      const createFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;"`;
      await runCommand(createFidCmd, env);
    } else {
      console.log(`fid column already exists in ${lowerTable}`);
    }

    // Check and rename geometry column if needed
    const checkGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name IN ('wkb_geometry', 'geom', 'geometry');"`;
    const { stdout: geomColumns } = await runCommand(checkGeomCmd, env);
    
    const columns = geomColumns.split('\n').map(col => col.trim()).filter(col => col);
    
    if (columns.includes('wkb_geometry')) {
      console.log(`Renaming wkb_geometry to geom in ${lowerTable}...`);
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else if (!columns.includes('geom') && columns.includes('geometry')) {
      console.log(`Renaming geometry to geom in ${lowerTable}...`);
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else {
      console.log(`Geometry column is already named 'geom' or doesn't exist`);
    }

    // Create spatial index
    console.log(`Creating spatial index for ${lowerTable}...`);
    const indexCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);"`; 
    await runCommand(indexCmd, env);

    // Update geometry metadata
    console.log(`Updating geometry metadata for ${lowerTable}...`);
    const updateGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "SELECT UpdateGeometrySRID('${lowerTable}', 'geom', 4326);"`;
    await runCommand(updateGeomCmd, env);

    console.log(`PostgreSQL table ${lowerTable} fixed successfully`);
    return true;
  } catch (error) {
    console.error("Error fixing PostgreSQL table:", error.stderr || error.message);
    return false;
  }
}

// --- Publish to GeoServer ---
async function publishToGeoServer(tableName, color) {
  try {
    const lowerTable = tableName.toLowerCase();
    console.log(`Publishing ${lowerTable} to GeoServer...`);

    // Create or update feature type
    const xml = `<featureType>
  <name>${lowerTable}</name>
  <nativeName>${lowerTable}</nativeName>
  <title>${lowerTable}</title>
  <srs>EPSG:4326</srs>
  <enabled>true</enabled>
</featureType>`;

    const featureTypeUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`;

    console.log(`Creating feature type at: ${featureTypeUrl}`);
    await axios.post(featureTypeUrl, xml, {
      auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
      headers: { "Content-Type": "text/xml" }
    });

    // Create SLD style
    const styleName = `${lowerTable}_style`;
    const sld = generateSLD(lowerTable, color);

    console.log(`Creating/updating style: ${styleName}`);
    try {
      await axios.put(`${GEOSERVER_URL}/rest/styles/${styleName}`, sld, {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
      console.log(`Style ${styleName} updated`);
    } catch (putError) {
      console.log(`Style ${styleName} doesn't exist, creating new...`);
      await axios.post(`${GEOSERVER_URL}/rest/styles?name=${styleName}`, sld, {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
      console.log(`Style ${styleName} created`);
    }

    // Apply style to layer
    console.log(`Applying style to layer ${WORKSPACE}:${lowerTable}`);
    await axios.put(
      `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
      `<layer><defaultStyle><name>${styleName}</name></defaultStyle></layer>`,
      {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/xml" }
      }
    );

    console.log(`Published ${lowerTable} to GeoServer successfully`);
    return true;
  } catch (error) {
    console.error("GeoServer publish error:", error.response?.data || error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// --- Add columns to coupe_village_master table ---
async function addcolumnsintable(tableName) {
  try {
    const lowerTable = tableName.toLowerCase();
    
    console.log(`Starting to process villages for table: ${lowerTable}`);
    
    // Get distinct village values
    const [villages] = await sequelize.query(
      `SELECT DISTINCT village 
       FROM "${lowerTable}" 
       WHERE village IS NOT NULL 
       AND TRIM(village) != '' 
       ORDER BY village`,
      {
        bind: []
      }
    );
    
    console.log(`Found ${villages.length} distinct villages`);
    
    if (villages.length === 0) {
      console.log(`No village data found in table: ${lowerTable}`);
      return false;
    }
    
    // Insert villages into coupe_village_master (simple INSERT IGNORE approach)
    let insertedCount = 0;
    let duplicateCount = 0;
    
    for (const village of villages) {
      try {
        const villageName = village.village ? village.village.toString().trim() : '';
        if (!villageName) continue;
        
        // Use a simple INSERT and catch duplicates
        try {
          await sequelize.query(
            `INSERT INTO coupe_village_master (coupe_name, village_name) 
             VALUES ($1, $2)`,
            {
              bind: [lowerTable, villageName]
            }
          );
          insertedCount++;
          console.log(`✓ Inserted: ${villageName} for ${lowerTable}`);
        } catch (insertErr) {
          // If it's a duplicate key error, just skip it
          if (insertErr.message.includes('duplicate') || 
              insertErr.message.includes('unique') ||
              insertErr.code === '23505') {
            duplicateCount++;
            // Duplicate entry, skip it
            continue;
          } else {
            console.error(`Error inserting village ${villageName}:`, insertErr.message);
          }
        }
      } catch (villageErr) {
        console.error(`Error processing village ${village.village}:`, villageErr.message);
      }
    }
    
    console.log(`Successfully inserted ${insertedCount} villages, skipped ${duplicateCount} duplicates from ${lowerTable} into coupe_village_master`);
    
    return insertedCount > 0;
    
  } catch (err) {
    console.error('Error in addcolumnsintable:', err.message);
    return false;
  }
}

// --- Test GDAL Connection ---
async function testGDALConnection() {
  try {
    console.log("Testing GDAL installation...");
    const { stdout } = await runCommand('ogr2ogr --version');
    console.log(`✓ GDAL Version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.error("✗ GDAL not found or not in PATH");
    console.error("Please ensure GDAL is installed and in system PATH");
    return false;
  }
}

// --- Upload shapefile route ---
router.post("/upload-shp", upload.array("files"), async (req, res) => {
  let uploadedFiles = [];
  try {
    // Test GDAL connection first
    const gdalAvailable = await testGDALConnection();
    if (!gdalAvailable) {
      return res.status(500).json({
        success: false,
        message: "GDAL not available. Please install GDAL and add to PATH.",
        details: "Run 'ogr2ogr --version' in command prompt to verify installation"
      });
    }

    const color = req.body.color || "#0000ff";
    const shpFile = req.files.find(f => f.originalname.endsWith(".shp"));
    if (!shpFile) return res.status(400).json({ success: false, message: "No shapefile (.shp) found" });

    uploadedFiles = req.files;

    const originalTableName = path.basename(shpFile.originalname, ".shp");
    const tableName = originalTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);

    console.log(`========================================`);
    console.log(`Processing shapefile: ${originalTableName}`);
    console.log(`Table name will be: ${tableName}`);
    console.log(`Color: ${color}`);
    console.log(`========================================`);

    // Step 1: Import shapefile to PostgreSQL using ogr2ogr
    console.log(`\n[1/6] Importing shapefile to PostgreSQL...`);
    
    // Build the ogr2ogr command
// Use this if shapefile doesn't have projection info
const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-lco PRECISION=NO \
-a_srs EPSG:4326 \
-overwrite \
-skipfailures \
--config PG_USE_COPY YES`;

    console.log("Running ogr2ogr command...");
    console.log("Command preview:", ogrCmd.substring(0, 150) + "...");
    
    const ogrResult = await runCommand(ogrCmd);
    
    if (ogrResult.stdout) {
      console.log("ogr2ogr output:", ogrResult.stdout.substring(0, 300));
    }
    
    if (ogrResult.stderr && ogrResult.stderr.length > 0) {
      console.warn("ogr2ogr warnings:", ogrResult.stderr.substring(0, 500));
    }

    console.log(`✓ Shapefile imported to PostgreSQL table: ${tableName}`);

    // Step 2: Wait for table to be fully created
    console.log(`\n[2/6] Waiting for table creation to complete...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Fix PostgreSQL table for GeoServer
    console.log(`\n[3/6] Fixing PostgreSQL table for GeoServer...`);
    const tableFixed = await fixPostgreSQLTable(tableName);
    if (!tableFixed) {
      console.warn("Table fixing encountered issues, but continuing...");
    }

    // Step 4: Publish to GeoServer
    console.log(`\n[4/6] Publishing to GeoServer...`);
    try {
      await publishToGeoServer(tableName, color);
      console.log(`✓ Published to GeoServer successfully`);
    } catch (geoServerError) {
      console.error("GeoServer publish failed:", geoServerError.message);
      // Continue with village processing even if GeoServer fails
    }

    // Step 5: Add village data to coupe_village_master table
    console.log(`\n[5/6] Adding village data to coupe_village_master...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before querying
    const villageInserted = await addcolumnsintable(tableName);
    
    if (villageInserted) {
      console.log(`✓ Village data added to coupe_village_master`);
    } else {
      console.log(`⚠ No village data found or inserted`);
    }

    // Step 6: Cleanup uploaded files
    console.log(`\n[6/6] Cleaning up uploaded files...`);
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Deleted: ${file.originalname}`);
        } catch (cleanupErr) {
          console.warn(`⚠ Failed to delete ${filePath}:`, cleanupErr.message);
        }
      }
    });

    console.log(`\n✅ Upload process completed successfully!`);
    console.log(`========================================`);

    // Success response
    res.json({
      success: true,
      message: "Shapefile uploaded & published successfully",
      details: {
        table: tableName,
        color: color,
        wmsUrl: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
        layerName: `${WORKSPACE}:${tableName}`,
        wfsUrl: `${GEOSERVER_URL}/${WORKSPACE}/ows`,
        villagesInserted: villageInserted,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("\n❌ Upload error occurred:");
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    
    if (err.stderr) {
      console.error("Command stderr:", err.stderr.substring(0, 500));
    }
    
    if (err.stdout) {
      console.error("Command stdout:", err.stdout.substring(0, 500));
    }
    
    // Cleanup on error
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Cleaned up on error: ${file.originalname}`);
        } catch (cleanupErr) {
          console.warn(`⚠ Failed to delete ${filePath}:`, cleanupErr.message);
        }
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message || "Unknown error",
      details: {
        stderr: err.stderr ? err.stderr.substring(0, 500) : null,
        stdout: err.stdout ? err.stdout.substring(0, 500) : null,
        code: err.code
      }
    });
  }
});

// --- Test endpoint ---
router.get("/test-gdal", async (req, res) => {
  try {
    const gdalAvailable = await testGDALConnection();
    
    if (gdalAvailable) {
      // Test PostgreSQL connection
      const env = { ...process.env, PGPASSWORD: PG_PASS };
      const testCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT version();"`;
      
      try {
        const { stdout } = await runCommand(testCmd, env);
        console.log("PostgreSQL version:", stdout.trim());
        
        res.json({
          success: true,
          gdal: "Available",
          postgresql: "Connected",
          postgresVersion: stdout.trim().split('\n')[0],
          message: "System ready for shapefile uploads"
        });
      } catch (pgError) {
        res.json({
          success: true,
          gdal: "Available",
          postgresql: "Connection failed",
          message: "GDAL is ready but PostgreSQL connection failed",
          error: pgError.message
        });
      }
    } else {
      res.status(500).json({
        success: false,
        gdal: "Not available",
        message: "GDAL is not installed or not in PATH"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: error.message
    });
  }
});

router.get('/admincoupes',  verifyJwt, async (req, res) => {
  try {

    const [result] = await sequelize.query(
      `	SELECT DISTINCT coupe_name FROM public.coupe_village_master`,
    );

    res.json({ 
      
      data: result,
      
    });
  } catch (err) {
    console.error('Error /api/villages:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error', 
      message: err.message 
    });
  }
});

module.exports = router;