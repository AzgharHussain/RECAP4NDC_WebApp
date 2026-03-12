const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const https = require("https");
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
const GEOSERVER_PASS = "Geo@$ecure#%26";
const WORKSPACE = "Recap4NDC";
const DATASTORE = "Recap4NDC_New_Final";

// Create HTTPS agent that ignores SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Environment variables for GDAL
const GDAL_ENV = {
  ...process.env,
  PATH: `${process.env.PATH};C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\bin;C:\\Program Files\\PostgreSQL\\17\\bin`,
  GDAL_DATA: "C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\share\\gdal",
  PROJ_LIB: "C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\share\\proj",
  // Skip PROJ version check
  PROJ_IGNORE_CATALOG_ERRORS: "YES",
  PROJ_NETWORK: "OFF"
};
// --------------------------------

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// --- Utility: Run shell commands ---
function runCommand(cmd, env = GDAL_ENV) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${cmd.substring(0, 100)}...`);
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, env }, (err, stdout, stderr) => {
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
    const { stdout } = await runCommand('ogr2ogr --version');
    console.log(`✓ GDAL Version: ${stdout.trim()}`);
    
    try {
      const { stdout: pgVersion } = await runCommand('psql --version');
      console.log(`✓ PostgreSQL client: ${pgVersion.trim()}`);
    } catch (pgError) {
      console.warn("⚠ PostgreSQL client not found in PATH");
    }
    
    return true;
  } catch (error) {
    console.error("✗ GDAL not found or not in PATH");
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
    const env = { ...GDAL_ENV, PGPASSWORD: PG_PASS };
    const lowerTable = tableName.toLowerCase();

    console.log(`Fixing PostgreSQL table: ${lowerTable}`);

    // Check if table exists
    const checkTableCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${lowerTable}');"`;
    
    try {
      const { stdout } = await runCommand(checkTableCmd, env);
      if (!stdout.trim().includes('t')) {
        console.error(`Table ${lowerTable} does not exist in database`);
        return false;
      }
    } catch (error) {
      console.error("Error checking table existence:", error.stderr || error.message);
      return false;
    }

    // Check if fid exists
    const checkFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='fid';"`;
    const { stdout: fidResult } = await runCommand(checkFidCmd, env);

    if (!fidResult.trim()) {
      console.log(`Adding fid column to ${lowerTable}...`);
      const createFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;"`;
      await runCommand(createFidCmd, env);
    }

    // Check geometry column
    const checkGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name IN ('wkb_geometry', 'geom', 'geometry');"`;
    const { stdout: geomColumns } = await runCommand(checkGeomCmd, env);
    
    const columns = geomColumns.split('\n').map(col => col.trim()).filter(col => col);
    
    if (columns.includes('wkb_geometry') && !columns.includes('geom')) {
      console.log(`Renaming wkb_geometry to geom in ${lowerTable}...`);
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else if (columns.includes('geometry') && !columns.includes('geom')) {
      console.log(`Renaming geometry to geom in ${lowerTable}...`);
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN geometry TO geom;"`;
      await runCommand(geomCmd, env);
    }

    // Create spatial index if geom column exists
    if (columns.includes('geom') || columns.includes('wkb_geometry') || columns.includes('geometry')) {
      console.log(`Creating spatial index for ${lowerTable}...`);
      const indexCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);"`; 
      await runCommand(indexCmd, env);
    }

    console.log(`PostgreSQL table ${lowerTable} fixed successfully`);
    return true;
  } catch (error) {
    console.error("Error fixing PostgreSQL table:", error.stderr || error.message);
    return false;
  }
}

// --- Publish to GeoServer ---
// --- Publish to GeoServer ---
async function publishToGeoServer(tableName, color) {
  try {
    const lowerTable = tableName.toLowerCase();
    console.log(`Publishing ${lowerTable} to GeoServer...`);

    const axiosInstance = axios.create({
      httpsAgent,
      auth: {
        username: GEOSERVER_USER,
        password: GEOSERVER_PASS
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    // First, check if the layer already exists
    try {
      await axiosInstance.get(`${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`);
      console.log(`Layer ${lowerTable} already exists, will update if needed`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Layer ${lowerTable} does not exist, will create`);
      }
    }

    // Create feature type if it doesn't exist
    const featureTypeXml = `<featureType>
  <name>${lowerTable}</name>
  <nativeName>${lowerTable}</nativeName>
  <title>${lowerTable}</title>
  <srs>EPSG:4326</srs>
  <enabled>true</enabled>
</featureType>`;

    const featureTypeUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`;

    try {
      console.log(`Creating feature type at: ${featureTypeUrl}`);
      await axiosInstance.post(featureTypeUrl, featureTypeXml, {
        headers: { "Content-Type": "application/xml" } // Changed from text/xml
      });
    } catch (postError) {
      if (postError.response?.status === 500) {
        console.log("Feature type may already exist, attempting update...");
        try {
          const updateUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes/${lowerTable}`;
          await axiosInstance.put(updateUrl, featureTypeXml, {
            headers: { "Content-Type": "application/xml" } // Changed from text/xml
          });
        } catch (updateError) {
          if (updateError.response?.status === 404) {
            console.log("Feature type not found for update, will continue with style creation");
          } else {
            throw updateError;
          }
        }
      } else if (postError.response?.status !== 409) { // Conflict is OK
        throw postError;
      }
    }

    // Create/Update style - FIXED VERSION
    const styleName = `${lowerTable}_style`;
    const sld = generateSLD(lowerTable, color);

    console.log(`Creating/updating style: ${styleName}`);
    
    // First, check if style exists
    let styleExists = false;
    try {
      await axiosInstance.get(`${GEOSERVER_URL}/rest/styles/${styleName}.json`);
      styleExists = true;
      console.log(`Style ${styleName} already exists, updating...`);
    } catch (error) {
      if (error.response?.status === 404) {
        styleExists = false;
        console.log(`Style ${styleName} does not exist, creating...`);
      } else {
        throw error;
      }
    }

    if (styleExists) {
      // Update existing style - PUT with SLD content
      await axiosInstance.put(`${GEOSERVER_URL}/rest/styles/${styleName}`, sld, {
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
    } else {
      // Create new style - need to POST to create the style first, then PUT the SLD
      
      // Step 1: Create the style (empty) - FIXED: Use application/xml instead of text/xml
      const createStyleXml = `<style>
  <name>${styleName}</name>
  <filename>${styleName}.sld</filename>
</style>`;
      
      await axiosInstance.post(`${GEOSERVER_URL}/rest/styles`, createStyleXml, {
        headers: { "Content-Type": "application/xml" } // Changed from text/xml to application/xml
      });
      
      // Step 2: Upload the SLD content
      await axiosInstance.put(`${GEOSERVER_URL}/rest/styles/${styleName}`, sld, {
        headers: { "Content-Type": "application/vnd.ogc.sld+xml" }
      });
    }

    // Apply style to layer
    console.log(`Applying style to layer ${WORKSPACE}:${lowerTable}`);
    
    // Wait a moment for style to be fully created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const layerXml = `<layer>
  <defaultStyle>
    <name>${styleName}</name>
    <workspace>${WORKSPACE}</workspace>
  </defaultStyle>
  <enabled>true</enabled>
</layer>`;

    try {
      await axiosInstance.put(
        `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
        layerXml,
        {
          headers: { "Content-Type": "application/xml" } // Changed from text/xml
        }
      );
    } catch (layerError) {
      // If layer doesn't exist, try to create it
      if (layerError.response?.status === 404) {
        console.log(`Layer ${lowerTable} not found, creating with style...`);
        
        // Create layer with style
        const createLayerXml = `<layer>
  <name>${lowerTable}</name>
  <type>VECTOR</type>
  <defaultStyle>
    <name>${styleName}</name>
    <workspace>${WORKSPACE}</workspace>
  </defaultStyle>
  <resource class="featureType">${WORKSPACE}:${lowerTable}</resource>
  <enabled>true</enabled>
</layer>`;
        
        await axiosInstance.post(
          `${GEOSERVER_URL}/rest/layers`,
          createLayerXml,
          {
            headers: { "Content-Type": "application/xml" } // Changed from text/xml
          }
        );
      } else {
        throw layerError;
      }
    }

    console.log(`Published ${lowerTable} to GeoServer successfully`);
    return true;
  } catch (error) {
    console.error("GeoServer publish error:", error.response?.data || error.message);
    console.error("Full error details:", error);
    throw error;
  }
}

const createPatrolBoundaryTable = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS patrol_boundaries (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(200) UNIQUE NOT NULL,
        boundary_name VARCHAR(200),
        workspace VARCHAR(100),
        layer_name VARCHAR(200),
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Patrol boundaries table ready");
  } catch (error) {
    console.error("Error creating patrol_boundaries table:", error);
  }
};

// --- Upload patrol boundary route ---
router.post(
  "/upload-patrol-boundary",
  verifyJwt,
  upload.array("files"),
  async (req, res) => {
    let uploadedFiles = [];

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded"
        });
      }

      uploadedFiles = req.files;

      const gdalAvailable = await testGDALConnection();
      if (!gdalAvailable) {
        return res.status(500).json({
          success: false,
          message: "GDAL not available"
        });
      }

      const shpFile = req.files.find(f =>
        f.originalname.toLowerCase().endsWith(".shp")
      );

      const shxFile = req.files.find(f =>
        f.originalname.toLowerCase().endsWith(".shx")
      );

      const dbfFile = req.files.find(f =>
        f.originalname.toLowerCase().endsWith(".dbf")
      );

      if (!shpFile || !shxFile || !dbfFile) {
        return res.status(400).json({
          success: false,
          message: "Missing shapefile components (.shp .shx .dbf required)"
        });
      }

      const color = req.body.color || "#ff0000";
      const originalName = path.basename(shpFile.originalname, ".shp");
      const cleanName = originalName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      const tableName = `patrol_boundary_${cleanName}`;
      const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);

      console.log("Uploading Patrol Boundary:", tableName);

      // Import to PostGIS - without specifying SRS to avoid PROJ error
      const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-t_srs EPSG:4326 \
-overwrite \
-skipfailures`;

      console.log("Running ogr2ogr command...");
      
      try {
        await runCommand(ogrCmd);
        console.log("PostGIS import completed:", tableName);
      } catch (ogrError) {
        console.error("ogr2ogr error:", ogrError.stderr);
        
        // Try alternative approach without SRS transformation
        console.log("Retrying without SRS transformation...");
        const altCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-overwrite \
-skipfailures`;
        
        await runCommand(altCmd);
        console.log("PostGIS import completed on retry:", tableName);
      }

      // Wait for table to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Fix table
      await fixPostgreSQLTable(tableName);

      // Publish to GeoServer
      try {
        await publishToGeoServer(tableName, color);
        console.log("GeoServer layer published:", tableName);
      } catch (geoError) {
        console.error("GeoServer publish failed but continuing:", geoError.message);
      }

      // Save metadata
      await sequelize.query(
        `
        INSERT INTO patrol_boundaries
        (table_name, boundary_name, workspace, layer_name, color)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (table_name) DO NOTHING
        `,
        {
          bind: [
            tableName,
            originalName,
            WORKSPACE,
            `${WORKSPACE}:${tableName}`,
            color
          ]
        }
      );

      // Cleanup
      uploadedFiles.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      res.json({
        success: true,
        message: "Patrol Boundary Uploaded Successfully",
        data: {
          table: tableName,
          layer: `${WORKSPACE}:${tableName}`,
          workspace: WORKSPACE,
          wms_url: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
          color: color
        }
      });

    } catch (error) {
      console.error("Patrol Boundary Upload Error:", error);

      uploadedFiles.forEach(file => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      res.status(500).json({
        success: false,
        message: "Patrol Boundary Upload Failed",
        error: error.message,
        details: error.stderr || error.stdout || null
      });
    }
  }
);

// --- Get all patrol boundaries ---
router.get("/patrol-boundaries", verifyJwt, async (req, res) => {
  try {
    const result = await sequelize.query(
      `
      SELECT
        id,
        boundary_name AS name,
        table_name,
        layer_name,
        color,
        created_at
      FROM patrol_boundaries
      ORDER BY created_at DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error fetching patrol boundaries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patrol boundaries"
    });
  }
});

// --- Delete patrol boundary ---
router.delete("/patrol-boundaries/:id", verifyJwt, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sequelize.query(
      `SELECT table_name FROM patrol_boundaries WHERE id=$1`,
      {
        bind: [id],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "Boundary not found"
      });
    }

    const tableName = result[0].table_name;

    await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
    await sequelize.query(
      `DELETE FROM patrol_boundaries WHERE id=$1`,
      { bind: [id] }
    );

    res.json({
      success: true,
      message: "Boundary deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Delete failed"
    });
  }
});

// --- Test endpoint ---
router.get("/test-gdal", async (req, res) => {
  try {
    const gdalAvailable = await testGDALConnection();
    
    if (gdalAvailable) {
      const env = { ...GDAL_ENV, PGPASSWORD: PG_PASS };
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

// --- Admin coupes endpoint ---
router.get('/admincoupes', verifyJwt, async (req, res) => {
  try {
    const [result] = await sequelize.query(
      `SELECT DISTINCT coupe_name FROM public.coupe_village_master`,
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

createPatrolBoundaryTable();
module.exports = router;