const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");

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
function runCommand(cmd, env = process.env) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, env }, (err, stdout, stderr) => {
      if (err) {
        if (stderr && stderr.includes("WARNING")) {
          console.warn("Command warning:", stderr);
          return resolve({ stdout, stderr });
        }
        return reject({ err, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
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
    }

    // Check if wkb_geometry column exists before renaming
    const checkWkbCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='wkb_geometry';"`;
    const { stdout: wkbExists } = await runCommand(checkWkbCmd, env);
    
    if (wkbExists.trim()) {
      // Rename wkb_geometry to geom if it exists
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;"`;
      await runCommand(geomCmd, env);
    }

    // Create spatial index
    const indexCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);"`; 
    await runCommand(indexCmd, env);

    // Update geometry metadata
    const updateGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "SELECT Populate_Geometry_Columns('${lowerTable}'::regclass);"`; 
    await runCommand(updateGeomCmd, env);

    console.log("PostgreSQL table fixed successfully");
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
    } catch {
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

    console.log("Published to GeoServer successfully");
    return true;
  } catch (error) {
    console.error("GeoServer publish error:", error.response?.data || error.message);
    throw error;
  }
}

// --- Add columns to coupe_village_master table ---
// --- Simpler version without ON CONFLICT ---
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
    
    console.log(`Successfully inserted ${insertedCount} villages from ${lowerTable} into coupe_village_master`);
    
    return insertedCount > 0;
    
  } catch (err) {
    console.error('Error in addcolumnsintable:', err.message);
    return false;
  }
}

// --- Upload shapefile route ---
router.post("/upload-shp", upload.array("files"), async (req, res) => {
  let uploadedFiles = [];
  try {
    const color = req.body.color || "#0000ff";
    const shpFile = req.files.find(f => f.originalname.endsWith(".shp"));
    if (!shpFile) return res.status(400).json({ success: false, message: "No shapefile (.shp) found" });

    uploadedFiles = req.files;

    const originalTableName = path.basename(shpFile.originalname, ".shp");
    const tableName = originalTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);

    console.log(`Processing shapefile: ${originalTableName}`);
    console.log(`Table name will be: ${tableName}`);

    const ogr2ogrPath = `"C:/Program Files/QGIS 3.40.10/bin/ogr2ogr.exe"`;
    process.env.PROJ_LIB = "C:/Program Files/QGIS 3.40.10/share/proj";

    const ogrCmd = `${ogr2ogrPath} -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB}" \
"${shpPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-lco PRECISION=NO \
-t_srs EPSG:4326 \
-overwrite \
-skipfailures`;

    console.log("Running ogr2ogr command...");
    console.log("Command:", ogrCmd.substring(0, 200) + "...");
    
    const ogrResult = await runCommand(ogrCmd);
    console.log("ogr2ogr output:", ogrResult.stdout ? ogrResult.stdout.substring(0, 500) : "No output");
    
    if (ogrResult.stderr) {
      console.warn("ogr2ogr warnings:", ogrResult.stderr.substring(0, 500));
    }

    // Add delay to ensure table is fully created
    console.log("Waiting for table creation to complete...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Fix table for GeoServer
    console.log("Fixing PostgreSQL table for GeoServer...");
    await fixPostgreSQLTable(tableName);

    // Publish to GeoServer
    console.log("Publishing to GeoServer...");
    await publishToGeoServer(tableName, color);

    // Add delay before querying
    console.log("Waiting before querying villages...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Add village data to coupe_village_master table
    console.log("Adding village data to coupe_village_master...");
    const villageInserted = await addcolumnsintable(tableName);

    // Cleanup uploaded files
    console.log("Cleaning up uploaded files...");
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${file.originalname}`);
        } catch (cleanupErr) {
          console.warn(`Failed to delete ${filePath}:`, cleanupErr.message);
        }
      }
    });

    res.json({
      success: true,
      message: "Shapefile uploaded & published successfully",
      table: tableName,
      color,
      wmsUrl: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
      layerName: `${WORKSPACE}:${tableName}`,
      villagesInserted: villageInserted
    });

  } catch (err) {
    console.error("Upload error:", err);
    console.error("Error details:", err.stderr || err.message);
    
    // Cleanup on error
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up on error: ${file.originalname}`);
        } catch (cleanupErr) {
          console.warn(`Failed to delete ${filePath}:`, cleanupErr.message);
        }
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.stderr || err.message,
      details: err.response?.data || err.code
    });
  }
});

module.exports = router;