const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const { verifyJwt } = require("../middlewares/verifyJwt");
const { logFromRequest } = require("../utils/auditLogger");

const router = express.Router();

const { sequelize, testConnection } = require('../config/ndvidatabase');

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- DB & GEOSERVER CONFIG (from .env only) ---
const PG_HOST = process.env.DB_HOST;
const PG_USER = process.env.DB_USER;
const PG_PASS = process.env.DB_PASSWORD;
const PG_DB   = process.env.DB_NAME;

const GEOSERVER_URL  = process.env.GEOSERVER_URL;
const GEOSERVER_USER = process.env.GEOSERVER_USER;
const GEOSERVER_PASS = process.env.GEOSERVER_PASSWORD;
const WORKSPACE      = process.env.GEOSERVER_WORKSPACE  || 'Recap4NDC';
const DATASTORE      = process.env.GEOSERVER_STORE      || 'Recap4NDC_New';
// --------------------------------

// Multer storage — sanitize filename to prevent path traversal
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, safeName || `upload_${Date.now()}`);
  }
});
const upload = multer({ storage });

// --- Utility: Run shell commands ---
// --- Utility: Run shell commands with GDAL path ---
function runCommand(cmd, env = process.env) {
  // Add GDAL to PATH for this command
  const updatedEnv = {
    ...env,
    PATH: `${env.PATH};C:\\OSGeo4W\\bin`,
    GDAL_DATA: "C:\\OSGeo4W\\share\\gdal",
    PROJ_LIB: "C:\\OSGeo4W\\share\\proj"
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
    
    // Try multiple ways to find GDAL
    const gdalPaths = [
      "C:\\OSGeo4W\\bin\\ogr2ogr.exe",
      "ogr2ogr.exe",
      "ogr2ogr"
    ];
    
    for (const gdalPath of gdalPaths) {
      try {
        const { stdout } = await runCommand(`"${gdalPath}" --version`);
        return true;
      } catch (error) {
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


    // Check if fid exists; only create if missing
    const checkFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='fid';"`;
    const { stdout } = await runCommand(checkFidCmd, env);

    if (!stdout.trim()) {
      const createFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;"`;
      await runCommand(createFidCmd, env);
    } else {
    }

    // Check and rename geometry column if needed
    const checkGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name IN ('wkb_geometry', 'geom', 'geometry');"`;
    const { stdout: geomColumns } = await runCommand(checkGeomCmd, env);
    
    const columns = geomColumns.split('\n').map(col => col.trim()).filter(col => col);
    
    if (columns.includes('wkb_geometry')) {
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else if (!columns.includes('geom') && columns.includes('geometry')) {
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else {
    }

    // Create spatial index
    const indexCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);"`; 
    await runCommand(indexCmd, env);

    // Update geometry metadata
    const updateGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "SELECT UpdateGeometrySRID('${lowerTable}', 'geom', 4326);"`;
    await runCommand(updateGeomCmd, env);

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

    // Create or update feature type
    const xml = `<featureType>
  <name>${lowerTable}</name>
  <nativeName>${lowerTable}</nativeName>
  <title>${lowerTable}</title>
  <srs>EPSG:4326</srs>
  <enabled>true</enabled>
</featureType>`;

    const featureTypeUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`;

    await axios.post(featureTypeUrl, xml, {
      auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
      headers: { "Content-Type": "text/xml" }
    });

    // Create SLD style
    const styleName = `${lowerTable}_style`;
    const sld = generateSLD(lowerTable, color);

    try {
      await axios.put(`${GEOSERVER_URL}/rest/styles/${styleName}`, sld, {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
    } catch (putError) {
      await axios.post(`${GEOSERVER_URL}/rest/styles?name=${styleName}`, sld, {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
    }

    // Apply style to layer
    await axios.put(
      `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
      `<layer><defaultStyle><name>${styleName}</name></defaultStyle></layer>`,
      {
        auth: { username: GEOSERVER_USER, password: GEOSERVER_PASS },
        headers: { "Content-Type": "application/xml" }
      }
    );

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
    
    
    if (villages.length === 0) {
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
    
    
    return insertedCount > 0;
    
  } catch (err) {
    console.error('Error in addcolumnsintable:', err.message);
    return false;
  }
}

// --- Test GDAL Connection ---
async function testGDALConnection() {
  try {
    const { stdout } = await runCommand('ogr2ogr --version');
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


    // Step 1: Import shapefile to PostgreSQL using ogr2ogr
    
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

    
    const ogrResult = await runCommand(ogrCmd);
    
    if (ogrResult.stdout) {
    }
    
    if (ogrResult.stderr && ogrResult.stderr.length > 0) {
      console.warn("ogr2ogr warnings:", ogrResult.stderr.substring(0, 500));
    }


    // Step 2: Wait for table to be fully created
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Fix PostgreSQL table for GeoServer
    const tableFixed = await fixPostgreSQLTable(tableName);
    if (!tableFixed) {
      console.warn("Table fixing encountered issues, but continuing...");
    }

    // Step 4: Publish to GeoServer
    try {
      await publishToGeoServer(tableName, color);
    } catch (geoServerError) {
      console.error("GeoServer publish failed:", geoServerError.message);
      // Continue with village processing even if GeoServer fails
    }

    // Step 5: Add village data to coupe_village_master table
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before querying
    const villageInserted = await addcolumnsintable(tableName);
    
    if (villageInserted) {
    } else {
    }

    // Step 6: Cleanup uploaded files
    await Promise.all(uploadedFiles.map(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      return fs.promises.unlink(filePath)
        .then(() => console.log(`✓ Deleted: ${file.originalname}`))
        .catch(cleanupErr => console.warn(`⚠ Failed to delete ${filePath}:`, cleanupErr.message));
    }));


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

    logFromRequest(req, {
      action: 'FILE_UPLOAD',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'gis_file',
      resourceId: tableName,
      details: { tableName, villagesInserted: villageInserted },
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
    await Promise.all(uploadedFiles.map(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      return fs.promises.unlink(filePath)
        .then(() => console.log(`✓ Cleaned up on error: ${file.originalname}`))
        .catch(cleanupErr => console.warn(`⚠ Failed to delete ${filePath}:`, cleanupErr.message));
    }));
    
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

    logFromRequest(req, {
      action: 'FILE_UPLOAD_FAILED',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'gis_file',
      errorMessage: err.message,
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
    console.error('Error /api/admincoupes:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error', 
      message: err.message 
    });
  }
});

module.exports = router;

