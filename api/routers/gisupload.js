const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const https = require("https");
const { verifyJwt } = require("../middlewares/verifyJwt");
const { logFromRequest } = require("../utils/auditLogger");

const router = express.Router();

const { sequelize, testConnection } = require("../config/database");

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- DB & GEOSERVER CONFIG (from .env only) ---
const PG_HOST = process.env.DB_HOST;
const PG_USER = process.env.DB_USER;
const PG_PASS = process.env.DB_PASSWORD;
const PG_DB = process.env.DB_NAME;

const GEOSERVER_URL = process.env.GEOSERVER_URL;
const GEOSERVER_USER = process.env.GEOSERVER_USER;
const GEOSERVER_PASS = process.env.GEOSERVER_PASSWORD;
const WORKSPACE = process.env.GEOSERVER_WORKSPACE || 'Recap4NDC';
const DATASTORE = process.env.GEOSERVER_STORE || 'Recap4NDC_New_final1';

// Create HTTPS agent that ignores SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Environment variables for GDAL
const GDAL_ENV = {
  ...process.env,
  PATH: `${process.env.PATH};C:\\OSGeo4W\\bin;C:\\Program Files\\PostgreSQL\\17\\bin`,
  GDAL_DATA: "C:\\OSGeo4W\\share\\gdal",
  PROJ_LIB: "C:\\OSGeo4W\\share\\proj",
  PROJ_IGNORE_CATALOG_ERRORS: "YES",
  PROJ_NETWORK: "OFF",
};
// --------------------------------

// Multer storage — sanitize filename to prevent path traversal
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Remove path components, keep only basename, replace dangerous chars
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, safeName || `upload_${Date.now()}`);
  },
});
const upload = multer({ storage });

// --- Utility: Run shell commands ---
function runCommand(cmd, env = GDAL_ENV) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, env }, (err, stdout, stderr) => {
      if (err) {
        if (
          stderr &&
          (stderr.includes("WARNING") ||
            stderr.includes("Warning") ||
            stderr.includes("warning"))
        ) {
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
    const { stdout } = await runCommand("ogr2ogr --version");

    try {
      const { stdout: pgVersion } = await runCommand("psql --version");
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
// --- Fix PostgreSQL table for GeoServer ---
async function fixPostgreSQLTable(tableName) {
  try {
    const env = { ...GDAL_ENV, PGPASSWORD: PG_PASS };
    const lowerTable = tableName.toLowerCase();


    // Check if table exists with retry
    let tableExists = false;
    let retries = 5;
    
    while (retries > 0 && !tableExists) {
      const checkTableCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${lowerTable}');"`;
      
      try {
        const { stdout } = await runCommand(checkTableCmd, env);
        tableExists = stdout.trim().includes("t");
        
        if (!tableExists) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
        }
      } catch (error) {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!tableExists) {
      console.error(`Table ${lowerTable} does not exist in database after retries`);
      return false;
    }


    // Check and add geometry column if needed
    const checkGeomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name IN ('wkb_geometry', 'geom', 'geometry');"`;
    const { stdout: geomColumns } = await runCommand(checkGeomCmd, env);

    const columns = geomColumns
      .split("\n")
      .map((col) => col.trim())
      .filter((col) => col);


    if (columns.length === 0) {
      console.error(`No geometry column found in table ${lowerTable}`);
      return false;
    }

    // Standardize geometry column name to 'geom'
    if (columns.includes("wkb_geometry") && !columns.includes("geom")) {
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;"`;
      await runCommand(geomCmd, env);
    } else if (columns.includes("geometry") && !columns.includes("geom")) {
      const geomCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} RENAME COLUMN geometry TO geom;"`;
      await runCommand(geomCmd, env);
    }

    // Check if fid exists and add if needed
    const checkFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='${lowerTable}' AND column_name='fid';"`;
    const { stdout: fidResult } = await runCommand(checkFidCmd, env);

    if (!fidResult.trim()) {
      const createFidCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;"`;
      await runCommand(createFidCmd, env);
    }

    // Create spatial index
    const indexCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);"`;
    await runCommand(indexCmd, env);
    
    // Update SRID to 4326
    const updateSridCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "SELECT UpdateGeometrySRID('${lowerTable}', 'geom', 4326);"`;
    await runCommand(updateSridCmd, env);

    return true;
  } catch (error) {
    console.error(
      "Error fixing PostgreSQL table:",
      error.stderr || error.message,
    );
    return false;
  }
}

// --- Publish to GeoServer ---
async function publishToGeoServer(tableName, color) {
  try {
    const lowerTable = tableName.toLowerCase();

    const axiosInstance = axios.create({
      httpsAgent,
      auth: {
        username: GEOSERVER_USER,
        password: GEOSERVER_PASS,
      },
      headers: {
        Accept: "application/json",
      },
    });

    // First, check if the layer already exists
    let layerExists = false;
    try {
      await axiosInstance.get(
        `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
      );
      layerExists = true;
    } catch (error) {
      if (error.response?.status === 404) {
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
      await axiosInstance.post(featureTypeUrl, featureTypeXml, {
        headers: { "Content-Type": "application/xml" },
      });
    } catch (postError) {
      // If feature type already exists (409 Conflict) or other non-fatal errors
      if (postError.response?.status === 409) {
      } else if (postError.response?.status === 500) {
        // Try to verify if it exists by getting it
        try {
          const checkUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes/${lowerTable}`;
          await axiosInstance.get(checkUrl);
        } catch (checkError) {
        }
      } else {
        console.error("Error creating feature type:", postError.response?.data || postError.message);
        // Don't throw - continue with style creation
      }
    }

    // Create and apply style
    const styleName = `${lowerTable}_style`;
    const sld = generateSLD(lowerTable, color);


    // First, check if style exists
    let styleExists = false;
    try {
      await axiosInstance.get(`${GEOSERVER_URL}/rest/styles/${styleName}`);
      styleExists = true;
    } catch (error) {
      if (error.response?.status === 404) {
      }
    }

    try {
      if (styleExists) {
        // Update existing style with PUT
        await axiosInstance.put(
          `${GEOSERVER_URL}/rest/styles/${styleName}`,
          sld,
          {
            headers: {
              "Content-Type": "application/vnd.ogc.sld+xml",
            },
          },
        );
      } else {
        // Create new style with POST
        await axiosInstance.post(
          `${GEOSERVER_URL}/rest/styles?name=${styleName}`,
          sld,
          {
            headers: {
              "Content-Type": "application/vnd.ogc.sld+xml",
            },
          },
        );
      }
    } catch (styleError) {
      // If we get 403 with message that style already exists, it means our check missed it
      if (styleError.response?.status === 403 && 
          styleError.response?.data?.includes("already exists")) {
        
        try {
          // Try to update with PUT
          await axiosInstance.put(
            `${GEOSERVER_URL}/rest/styles/${styleName}`,
            sld,
            {
              headers: {
                "Content-Type": "application/vnd.ogc.sld+xml",
              },
            },
          );
        } catch (updateError) {
          console.error("Failed to update style:", updateError.response?.data || updateError.message);
          throw updateError;
        }
      } else {
        console.error("Style operation failed:", styleError.response?.data || styleError.message);
        throw styleError;
      }
    }

    // Wait a moment for style to be fully created/updated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Apply style to layer

    const layerXml = `<layer>
  <defaultStyle>
    <name>${styleName}</name>
    <workspace>${WORKSPACE}</workspace>
  </defaultStyle>
</layer>`;

    try {
      await axiosInstance.put(
        `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
        layerXml,
        {
          headers: { "Content-Type": "application/xml" },
        },
      );
    } catch (layerError) {
      // If layer doesn't exist, try to create it
      if (layerError.response?.status === 404) {

        try {
          // Create layer with style
          const createLayerXml = `<layer>
  <name>${lowerTable}</name>
  <type>VECTOR</type>
  <defaultStyle>
    <name>${styleName}</name>
  </defaultStyle>
  <resource class="featureType">${WORKSPACE}:${lowerTable}</resource>
  <enabled>true</enabled>
</layer>`;

          await axiosInstance.post(
            `${GEOSERVER_URL}/rest/layers`,
            createLayerXml,
            {
              headers: { "Content-Type": "application/xml" },
            },
          );
        } catch (createLayerError) {
          console.error(
            "Error creating layer:",
            createLayerError.response?.data || createLayerError.message,
          );
          // Don't throw - layer might still work with default style
        }
      } else {
        console.error("Error applying style to layer:", layerError.response?.data || layerError.message);
        // Don't throw - continue anyway
      }
    }

    return true;
  } catch (error) {
    console.error(
      "GeoServer publish error:",
      error.response?.data || error.message,
    );
    console.error("Full error details:", error);
    // Don't throw the error - we want to continue even if GeoServer publish fails
    return false;
  }
}

const getBoundaryDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

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
        boundary_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await sequelize.query(`
      ALTER TABLE patrol_boundaries
      ADD COLUMN IF NOT EXISTS boundary_date DATE DEFAULT CURRENT_DATE
    `);
  } catch (error) {
    console.error("Error creating patrol_boundaries table:", error);
  }
};

// --- UPDATE PATROL BOUNDARY (Replace/Update existing boundary) ---
// --- UPDATE PATROL BOUNDARY (Replace/Update existing boundary) ---
router.put(
  "/patrol-boundaries/:id",
  verifyJwt,
  upload.array("files"),
  async (req, res) => {
    let uploadedFiles = [];

    try {
      const { id } = req.params;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded for replacement",
        });
      }

      uploadedFiles = req.files;

      // Get existing boundary info
      const [existingBoundary] = await sequelize.query(
        `SELECT id, table_name, boundary_name, color FROM patrol_boundaries WHERE id = $1`,
        {
          bind: [id],
          type: sequelize.QueryTypes.SELECT,
        }
      );

      if (!existingBoundary) {
        return res.status(404).json({
          success: false,
          message: "Boundary not found",
        });
      }

      const gdalAvailable = await testGDALConnection();
      if (!gdalAvailable) {
        return res.status(500).json({
          success: false,
          message: "GDAL not available",
        });
      }

      // Determine file type
      const firstFile = req.files[0];
      const fileExt = path.extname(firstFile.originalname).toLowerCase();
      let isKML = false;

      if (fileExt === ".kml" || fileExt === ".kmz") {
        isKML = true;
      }

      const color = req.body.color || existingBoundary.color || "#ff0000";
      const tableName = existingBoundary.table_name;
      let importSuccess = false;

      // Create a temporary table name for the new import
      const tempTableName = `${tableName}_temp_${Date.now()}`;
      

      if (isKML) {
        // Handle KML file replacement
        const kmlFile = req.files.find(
          (f) =>
            f.originalname.toLowerCase().endsWith(".kml") ||
            f.originalname.toLowerCase().endsWith(".kmz"),
        );

        if (!kmlFile) {
          return res.status(400).json({
            success: false,
            message: "KML/KMZ file not found",
          });
        }

        const kmlPath = path.join(UPLOAD_DIR, kmlFile.originalname);

        // Import KML to temporary table
        const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${kmlPath}" \
-nln "${tempTableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-overwrite \
-skipfailures`;


        try {
          await runCommand(ogrCmd);
          importSuccess = true;
        } catch (ogrError) {
          console.error("ogr2ogr error for KML:", ogrError.stderr);

          // Try with simpler options
          const altCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${kmlPath}" \
-nln "${tempTableName}" \
-overwrite`;

          try {
            await runCommand(altCmd);
            importSuccess = true;
          } catch (altError) {
            console.error("Alternative import also failed:", altError);
          }
        }
      } else {
        // Handle SHP file replacement
        const shpFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".shp"),
        );

        const shxFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".shx"),
        );

        const dbfFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".dbf"),
        );

        if (!shpFile || !shxFile || !dbfFile) {
          return res.status(400).json({
            success: false,
            message: "Missing shapefile components (.shp .shx .dbf required)",
          });
        }

        const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);

        // Import SHP to temporary table
        const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tempTableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-overwrite \
-skipfailures`;


        try {
          await runCommand(ogrCmd);
          importSuccess = true;
        } catch (ogrError) {
          console.error("ogr2ogr error for SHP:", ogrError.stderr);

          // Try with simpler options
          const altCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tempTableName}" \
-overwrite`;

          try {
            await runCommand(altCmd);
            importSuccess = true;
          } catch (altError) {
            console.error("Alternative import also failed:", altError);
          }
        }
      }

      if (!importSuccess) {
        throw new Error("Failed to import new file to PostGIS");
      }

      // Wait for the temporary table to be fully created
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Fix the temporary table structure for GeoServer
      const tempTableFixed = await fixPostgreSQLTable(tempTableName);
      
      if (!tempTableFixed) {
        throw new Error(`Failed to fix temporary table structure`);
      }

      // Backup existing table (rename it)
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '_').slice(0, 19);
      const backupTableName = `${tableName}_backup_${timestamp}`;
      
      
      const env = { ...GDAL_ENV, PGPASSWORD: PG_PASS };
      
      try {
        // Check if table exists before trying to rename
        const checkTableCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}');"`;
        const { stdout } = await runCommand(checkTableCmd, env);
        
        if (stdout.trim().includes("t")) {
          // Table exists, rename it to backup
          const renameCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${tableName} RENAME TO ${backupTableName};"`;
          await runCommand(renameCmd, env);
        } else {
        }
      } catch (backupError) {
        console.error("Error creating backup:", backupError.message);
        // Continue anyway - we'll use the temp table directly
      }

      // Rename the temporary table to the final table name
      try {
        const renameCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${tempTableName} RENAME TO ${tableName};"`;
        await runCommand(renameCmd, env);
      } catch (renameError) {
        console.error("Error renaming table:", renameError.message);
        
        // Try to restore from backup if available
        try {
          const restoreCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${backupTableName} RENAME TO ${tableName};"`;
          await runCommand(restoreCmd, env);
        } catch (restoreError) {
          console.error("Failed to restore from backup:", restoreError.message);
        }
        
        throw new Error("Failed to rename table after import");
      }

      // Fix the final table structure again (to ensure everything is correct)
      await fixPostgreSQLTable(tableName);

      // Update GeoServer with new data and color
      try {
        await publishToGeoServer(tableName, color);
      } catch (geoError) {
        console.error("GeoServer publish failed:", geoError.message);
        // Don't fail the whole operation - the data is in PostGIS
      }

      // Update metadata with new color and potentially new boundary name if changed
      const newBoundaryName = path.basename(
        req.files[0].originalname,
        path.extname(req.files[0].originalname),
      );

      await sequelize.query(
        `
        UPDATE patrol_boundaries
        SET color = $1
        WHERE id = $2
        `,
        {
          bind: [color, id],
        },
      );

      // Cleanup uploaded files
      await Promise.all(uploadedFiles.map((file) => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        return fs.promises.unlink(filePath).catch(() => {});
      }));

      // Delete backup table after successful replacement
      try {
        const deleteBackupCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "DROP TABLE IF EXISTS ${backupTableName};"`;
        await runCommand(deleteBackupCmd, env);
      } catch (deleteError) {
        console.warn("Could not delete backup table:", deleteError.message);
      }

      const fileType = isKML ? "KML" : "SHP";

      res.json({
        success: true,
        message: `${fileType} Patrol Boundary Replaced Successfully`,
        data: {
          id: id,
          table: tableName,
          layer: `${WORKSPACE}:${tableName}`,
          workspace: WORKSPACE,
          wms_url: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
          color: color,
        },
      });

      logFromRequest(req, {
        action: 'BOUNDARY_UPDATE',
        status: 'SUCCESS',
        statusCode: 200,
        resourceType: 'patrol_boundary',
        resourceId: id,
        details: { tableName, fileType },
      });
      
    } catch (error) {
      console.error("Patrol Boundary Replace Error:", error);

      logFromRequest(req, {
        action: 'BOUNDARY_UPDATE',
        status: 'ERROR',
        statusCode: 500,
        resourceType: 'patrol_boundary',
        resourceId: req.params?.id || null,
        errorMessage: error.message,
      });

      // Cleanup uploaded files
      await Promise.all(uploadedFiles.map((file) => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        return fs.promises.unlink(filePath).catch(() => {});
      }));

      res.status(500).json({
        success: false,
        message: "Patrol Boundary Replacement Failed",
        error: error.message,
        details: error.stderr || error.stdout || null,
      });
    }
  },
);

// --- Upload patrol boundary route (supports both SHP and KML) ---
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
          message: "No files uploaded",
        });
      }

      uploadedFiles = req.files;

      const gdalAvailable = await testGDALConnection();
      if (!gdalAvailable) {
        return res.status(500).json({
          success: false,
          message: "GDAL not available",
        });
      }

      // Determine file type
      const firstFile = req.files[0];
      const fileExt = path.extname(firstFile.originalname).toLowerCase();
      let isKML = false;

      if (fileExt === ".kml" || fileExt === ".kmz") {
        isKML = true;
      }

      const color = req.body.color || "#ff0000";
      const boundaryDate = getBoundaryDate(req.body.boundary_date || req.body.date);
      let tableName;
      let importSuccess = false;

      // Check if we're replacing an existing boundary
      const boundaryName = req.body.boundary_name;
      let existingBoundary = null;
      
      if (boundaryName) {
        const [found] = await sequelize.query(
          `SELECT id, table_name FROM patrol_boundaries WHERE boundary_name = $1`,
          {
            bind: [boundaryName],
            type: sequelize.QueryTypes.SELECT,
          }
        );
        existingBoundary = found;
      }

      if (existingBoundary) {
        // This is a replace operation - use the existing table name
        tableName = existingBoundary.table_name;
        
        // Backup existing table
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '_').slice(0, 19);
        const backupTableName = `${tableName}_backup_${timestamp}`;
        
        try {
          const env = { ...GDAL_ENV, PGPASSWORD: PG_PASS };
          const backupCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${tableName} RENAME TO ${backupTableName};"`;
          await runCommand(backupCmd, env);
        } catch (backupError) {
          console.error("Error creating backup:", backupError.message);
        }
        
        // Drop the table after backup (it's renamed, so we need to create new one)
        const dropCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "DROP TABLE IF EXISTS ${tableName};"`;
        await runCommand(dropCmd, { ...GDAL_ENV, PGPASSWORD: PG_PASS });
      } else {
        // New boundary - generate new table name
        if (isKML) {
          const kmlFile = req.files.find(
            (f) =>
              f.originalname.toLowerCase().endsWith(".kml") ||
              f.originalname.toLowerCase().endsWith(".kmz"),
          );
          const originalName = path.basename(
            kmlFile.originalname,
            path.extname(kmlFile.originalname),
          );
          const cleanName = originalName
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .toLowerCase();
          tableName = `patrol_boundary_${cleanName}`;
        } else {
          const shpFile = req.files.find((f) =>
            f.originalname.toLowerCase().endsWith(".shp"),
          );
          const originalName = path.basename(shpFile.originalname, ".shp");
          const cleanName = originalName
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .toLowerCase();
          tableName = `patrol_boundary_${cleanName}`;
        }
      }

      if (isKML) {
        // Handle KML file
        const kmlFile = req.files.find(
          (f) =>
            f.originalname.toLowerCase().endsWith(".kml") ||
            f.originalname.toLowerCase().endsWith(".kmz"),
        );

        if (!kmlFile) {
          return res.status(400).json({
            success: false,
            message: "KML/KMZ file not found",
          });
        }

        const kmlPath = path.join(UPLOAD_DIR, kmlFile.originalname);


        // Import KML to PostGIS - Skip SRS transformation to avoid PROJ error
        const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${kmlPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-overwrite \
-skipfailures`;


        try {
          await runCommand(ogrCmd);
          importSuccess = true;
        } catch (ogrError) {
          console.error("ogr2ogr error for KML:", ogrError.stderr);

          // If that fails, try with even simpler options
          const altCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${kmlPath}" \
-nln "${tableName}" \
-overwrite`;

          await runCommand(altCmd);
          importSuccess = true;
        }
      } else {
        // Handle SHP file
        const shpFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".shp"),
        );

        const shxFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".shx"),
        );

        const dbfFile = req.files.find((f) =>
          f.originalname.toLowerCase().endsWith(".dbf"),
        );

        if (!shpFile || !shxFile || !dbfFile) {
          return res.status(400).json({
            success: false,
            message: "Missing shapefile components (.shp .shx .dbf required)",
          });
        }

        const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);


        // Import to PostGIS - Skip SRS transformation to avoid PROJ error
        const ogrCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tableName}" \
-nlt PROMOTE_TO_MULTI \
-lco GEOMETRY_NAME=geom \
-lco FID=fid \
-overwrite \
-skipfailures`;


        try {
          await runCommand(ogrCmd);
          importSuccess = true;
        } catch (ogrError) {
          console.error("ogr2ogr error for SHP:", ogrError.stderr);

          // If that fails, try with even simpler options
          const altCmd = `ogr2ogr -f "PostgreSQL" \
PG:"host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" \
"${shpPath}" \
-nln "${tableName}" \
-overwrite`;

          await runCommand(altCmd);
          importSuccess = true;
        }
      }

      if (!importSuccess) {
        throw new Error("Failed to import file to PostGIS");
      }

      // Wait for table to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Fix table
      await fixPostgreSQLTable(tableName);

      // Publish to GeoServer
      try {
        await publishToGeoServer(tableName, color);
      } catch (geoError) {
        console.error(
          "GeoServer publish failed but continuing:",
          geoError.message,
        );
      }

      // Save metadata
      const boundaryDisplayName = path.basename(
        req.files[0].originalname,
        path.extname(req.files[0].originalname),
      );

      await sequelize.query(
        `
        INSERT INTO patrol_boundaries
        (table_name, boundary_name, workspace, layer_name, color, boundary_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (table_name) 
        DO UPDATE SET 
          boundary_name = EXCLUDED.boundary_name,
          color = EXCLUDED.color,
          boundary_date = EXCLUDED.boundary_date
        `,
        {
          bind: [
            tableName,
            boundaryDisplayName,
            WORKSPACE,
            `${WORKSPACE}:${tableName}`,
            color,
            boundaryDate,
          ],
        },
      );

      // Cleanup
      await Promise.all(uploadedFiles.map((file) => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        return fs.promises.unlink(filePath).catch(() => {});
      }));

      const fileType = isKML ? "KML" : "SHP";

      res.json({
        success: true,
        message: existingBoundary 
          ? `${fileType} Patrol Boundary Replaced Successfully`
          : `${fileType} Patrol Boundary Uploaded Successfully`,
        data: {
          table: tableName,
          boundary_name: boundaryDisplayName,
          layer: `${WORKSPACE}:${tableName}`,
          workspace: WORKSPACE,
          wms_url: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
          color: color,
          boundary_date: boundaryDate,
          is_replace: !!existingBoundary,
        },
      });

      logFromRequest(req, {
        action: 'BOUNDARY_CREATE',
        status: 'SUCCESS',
        statusCode: 200,
        resourceType: 'patrol_boundary',
        resourceId: tableName,
        details: { tableName, boundaryDisplayName, fileType, isReplace: !!existingBoundary },
      });
    } catch (error) {
      console.error("Patrol Boundary Upload Error:", error);

      logFromRequest(req, {
        action: 'FILE_UPLOAD_FAILED',
        status: 'ERROR',
        statusCode: 500,
        resourceType: 'patrol_boundary',
        errorMessage: error.message,
      });

      await Promise.all(uploadedFiles.map((file) => {
        const filePath = path.join(UPLOAD_DIR, file.originalname);
        return fs.promises.unlink(filePath).catch(() => {});
      }));

      res.status(500).json({
        success: false,
        message: "Patrol Boundary Upload Failed",
        error: error.message,
        details: error.stderr || error.stdout || null,
      });
    }
  },
);

router.post("/patrol-boundaries/check-name", verifyJwt, async (req, res) => {
  try {
    const { name } = req.body;
    
    // Validate that name parameter is provided
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name parameter is required",
      });
    }

    const result = await sequelize.query(
      `
      SELECT EXISTS(
        SELECT 1 
        FROM patrol_boundaries 
        WHERE boundary_name = :name
      ) as exists
      `,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { name },
      },
    );

    res.json({
      success: true,
      exists: result[0].exists,
      message: result[0].exists ? "Name already exists" : "Name is available",
    });
  } catch (error) {
    console.error("Error checking patrol boundary name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check name availability",
    });
  }
});

// --- Get all patrol boundaries ---
router.get("/patrol-boundaries", verifyJwt, async (req, res) => {
  try {
    const boundaries = await sequelize.query(
      `
      SELECT
        id,
        boundary_name AS name,
        table_name,
        layer_name,
        workspace,
        color,
        boundary_date::text AS boundary_date,
        created_at
      FROM patrol_boundaries
      ORDER BY created_at DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const dataWithGeom = await Promise.all(
      boundaries.map(async (item) => {
        try {
          const geomResult = await sequelize.query(
            `SELECT geom FROM ${item.table_name} LIMIT 1`,
            { type: sequelize.QueryTypes.SELECT }
          );

          return {
  ...item,
  geom: geomResult.length
    ? {
        ...geomResult[0].geom,
        coordinates: geomResult[0].geom.coordinates[0]
      }
    : null,
};
        } catch (err) {
          console.error(`Error fetching geom from ${item.table_name}:`, err);
          return {
            ...item,
            geom: null,
          };
        }
      })
    );

    res.json({
      success: true,
      data: dataWithGeom,
    });

  } catch (error) {
    console.error("Error fetching patrol boundaries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patrol boundaries",
    });
  }
});

// --- Get single patrol boundary by ID ---
router.get("/patrol-boundaries/:id", verifyJwt, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await sequelize.query(
      `
      SELECT
        id,
        boundary_name AS name,
        table_name,
        layer_name,
        workspace,
        color,
        boundary_date::text AS boundary_date,
        created_at
      FROM patrol_boundaries
      WHERE id = $1
      `,
      {
        bind: [id],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "Boundary not found",
      });
    }

    res.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error("Error fetching patrol boundary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patrol boundary",
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
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "Boundary not found",
      });
    }

    const tableName = result[0].table_name;

    // Drop the table from PostgreSQL
    await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
    
    // Delete from metadata table
    await sequelize.query(`DELETE FROM patrol_boundaries WHERE id=$1`, {
      bind: [id],
    });

    res.json({
      success: true,
      message: "Boundary deleted successfully",
    });

    logFromRequest(req, {
      action: 'BOUNDARY_DELETE',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'patrol_boundary',
      resourceId: id,
      details: { tableName },
    });
  } catch (error) {
    console.error(error);

    logFromRequest(req, {
      action: 'BOUNDARY_DELETE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'patrol_boundary',
      resourceId: req.params?.id || null,
      errorMessage: error.message,
    });
    res.status(500).json({
      success: false,
      message: "Delete failed",
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
          postgresVersion: stdout.trim().split("\n")[0],
          message: "System ready for shapefile and KML uploads",
        });
      } catch (pgError) {
        res.json({
          success: true,
          gdal: "Available",
          postgresql: "Connection failed",
          message: "GDAL is ready but PostgreSQL connection failed",
          error: pgError.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        gdal: "Not available",
        message: "GDAL is not installed or not in PATH",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: error.message,
    });
  }
});

// --- Create boundary from coordinates (Optional - kept for reference) ---
router.post("/create-boundary", verifyJwt, async (req, res) => {
  const {
    name,
    geom,
    color = "#ff0000",
    officer_name,
    division,
    range,
    round,
    beat,
    village,
    boundary_date,
    date,
  } = req.body;

  if (!name || !geom) {
    return res.status(400).json({
      success: false,
      message: "Name and geometry are required",
    });
  }

  try {
    const boundaryDate = getBoundaryDate(boundary_date || date);

    // Check if boundary name already exists
    const nameCheckResult = await sequelize.query(
      `
      SELECT EXISTS(
        SELECT 1 
        FROM patrol_boundaries 
        WHERE boundary_name = :name
      ) as exists
      `,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { name },
      },
    );

    if (nameCheckResult[0].exists) {
      return res.status(409).json({
        success: false,
        message: `Boundary with name '${name}' already exists. Please use a different name.`,
      });
    }


    // Parse geometry string to array
    let parsedCoordinates;

    if (typeof geom === "string") {
      parsedCoordinates = geom.split(",").map((point) => {
        const [lat, lng] = point.trim().split(" ").map(Number);
        return [lat, lng];
      });
    } else if (Array.isArray(geom)) {
      parsedCoordinates = geom;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid geometry format",
      });
    }

    // Validate coordinates
    if (parsedCoordinates.length < 3) {
      return res.status(400).json({
        success: false,
        message: "At least 3 coordinate points are required",
      });
    }

    // Sanitize table name
    const tableName = `patrol_boundary_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    // Convert coordinates to polygon format: "lng lat, lng lat"
    const polygonPoints = parsedCoordinates
      .map((coord) => `${coord[1]} ${coord[0]}`)
      .join(",");
    const polygonText = `POLYGON((${polygonPoints}))`;


    // Create dynamic table with additional fields
    const createTable = `
            CREATE TABLE IF NOT EXISTS public.${tableName} (
                id SERIAL PRIMARY KEY,
                geom GEOMETRY(POLYGON, 4326),
                officer_name VARCHAR(255),
                division VARCHAR(255),
                range VARCHAR(255),
                round VARCHAR(255),
                beat VARCHAR(255),
                village VARCHAR(255),
                boundary_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

    await sequelize.query(createTable);

    // Insert data into dynamic table with all fields
    const insertIntoTable = `
            INSERT INTO public.${tableName} (
                geom, 
                officer_name, 
                division, 
                range, 
                round, 
                beat, 
                village,
                boundary_date
            )
            VALUES (
                ST_GeomFromText(:polygonText, 4326),
                :officer_name,
                :division,
                :range,
                :round,
                :beat,
                :village,
                :boundaryDate
            )
        `;

    await sequelize.query(insertIntoTable, {
      replacements: {
        polygonText,
        officer_name: officer_name || null,
        division: division || null,
        range: range || null,
        round: round || null,
        beat: beat || null,
        village: village || null,
        boundaryDate,
      },
    });

    // Fix table for GeoServer
    await fixPostgreSQLTable(tableName);

    // Publish to GeoServer
    await publishToGeoServer(tableName, color);

    // Save metadata
    await sequelize.query(
      `
            INSERT INTO patrol_boundaries (table_name, boundary_name, workspace, layer_name, color, boundary_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (table_name) DO NOTHING
            `,
      {
        bind: [
          tableName,
          name,
          WORKSPACE,
          `${WORKSPACE}:${tableName}`,
          color,
          boundaryDate,
        ],
      },
    );

    res.json({
      success: true,
      message: `Boundary '${name}' created and published to GeoServer`,
      data: {
        boundary_name: name,
        table_name: tableName,
        geoserver_layer: `${WORKSPACE}:${tableName}`,
        wms_url: `${GEOSERVER_URL}/${WORKSPACE}/wms`,
        color: color,
        boundary_date: boundaryDate,
        total_points: parsedCoordinates.length,
        metadata: {
          officer_name: officer_name || null,
          division: division || null,
          range: range || null,
          round: round || null,
          beat: beat || null,
          village: village || null,
          boundary_date: boundaryDate,
        },
      },
    });
  } catch (error) {
    console.error("Create boundary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create boundary",
      error: error.message,
    });
  }
});

createPatrolBoundaryTable();

module.exports = router;