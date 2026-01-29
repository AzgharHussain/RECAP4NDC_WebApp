import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// --- DB & GEOSERVER CONFIG ---
const PG_HOST = "68.178.167.216";
const PG_USER = "postgres";
const PG_PASS = "pass@123";
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

    // Ensure lowercase table name
    const lowerTable = tableName.toLowerCase();

    // Check if fid exists; only create if missing
    const addFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='fid';"`;
    const { stdout } = await runCommand(addFidCmd, env);

    if (!stdout.trim()) {
      const createFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;"`;
      await runCommand(createFidCmd, env);
    }

    // Ensure geometry column is named 'geom'
    const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN IF EXISTS wkb_geometry TO geom;"`;
    await runCommand(geomCmd, env);

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

// --- Upload shapefile route ---
app.post("/upload-shp", upload.array("files"), async (req, res) => {
  let uploadedFiles = [];
  try {
    const color = req.body.color || "#0000ff";
    const shpFile = req.files.find(f => f.originalname.endsWith(".shp"));
    if (!shpFile) return res.status(400).json({ success: false, message: "No shapefile (.shp) found" });

    uploadedFiles = req.files;

    const tableName = path.basename(shpFile.originalname, ".shp").replace(/[^a-zA-Z0-9_]/g, '_');
    const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);

    const ogr2ogrPath = `"C:/Program Files/QGIS 3.40.10/bin/ogr2ogr.exe"`;
    process.env.PROJ_LIB = "C:/Program Files/QGIS 3.40.10/share/proj";

const ogrCmd = `${ogr2ogrPath} -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB}" \
"${shpPath}" \
-nln "${tableName.toLowerCase()}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-lco PRECISION=NO \
-t_srs EPSG:4326 \
-overwrite \
-skipfailures`;

    console.log("Running ogr2ogr command...");
    await runCommand(ogrCmd);

    // Fix table for GeoServer
    await fixPostgreSQLTable(tableName);

    // Publish to GeoServer
    await publishToGeoServer(tableName, color);

    // Cleanup
    uploadedFiles.forEach(file => fs.existsSync(path.join(UPLOAD_DIR, file.originalname)) && fs.unlinkSync(path.join(UPLOAD_DIR, file.originalname)));

    res.json({
      success: true,
      message: "Shapefile uploaded & published successfully",
      table: tableName.toLowerCase(),
      color,
      wmsUrl: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
      layerName: `${WORKSPACE}:${tableName.toLowerCase()}`
    });

  } catch (err) {
    console.error("Upload error:", err);
    uploadedFiles.forEach(file => fs.existsSync(path.join(UPLOAD_DIR, file.originalname)) && fs.unlinkSync(path.join(UPLOAD_DIR, file.originalname)));
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.stderr || err.message,
      details: err.response?.data || err.code
    });
  }
});

