const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const { verifyJwt } = require("../middlewares/verifyJwt");

const router = express.Router();

const { sequelize } = require('../config/ndvidatabase');

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

// --- GDAL CONFIGURATION (CACHED) ---
const GDAL_PATHS = [
    "C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\bin\\ogr2ogr.exe",
    "ogr2ogr.exe",
    "ogr2ogr"
];

const GDAL_ENV = {
    PATH: `${process.env.PATH};C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\bin`,
    GDAL_DATA: "C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\share\\gdal",
    PROJ_LIB: "C:\\Users\\HP\\AppData\\Local\\Programs\\OSGeo4W\\share\\proj"
};

// Cache for GDAL availability
let gdalAvailable = null;
let gdalPath = null;
let gdalCheckInProgress = false;
let gdalCheckPromise = null;

// --------------------------------

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// --- Utility: Run shell commands with GDAL path (FIXED) ---
function runCommand(cmd, env = process.env) {
  const updatedEnv = gdalPath 
    ? { ...env, PATH: `${env.PATH};${path.dirname(gdalPath)}`, ...GDAL_ENV }
    : { ...env, ...GDAL_ENV };
  
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, env: updatedEnv }, (err, stdout, stderr) => {
      if (err) {
        // Command failed (non-zero exit code)
        if (stderr && (stderr.includes("WARNING") || stderr.includes("Warning") || stderr.includes("warning"))) {
          console.warn("Command had warnings:", stderr.substring(0, 500));
        }
        return reject({ err, stdout, stderr });
      }
      // Success – log any warnings that might have been emitted
      if (stderr && (stderr.includes("WARNING") || stderr.includes("Warning") || stderr.includes("warning"))) {
        console.warn("Command warning (non-fatal):", stderr.substring(0, 500));
      }
      resolve({ stdout, stderr });
    });
  });
}

// --- Cached GDAL Connection Test ---
async function getGDALAvailability(forceCheck = false) {
  if (!forceCheck && gdalAvailable !== null) {
    return gdalAvailable;
  }

  if (gdalCheckInProgress) {
    return gdalCheckPromise;
  }

  gdalCheckInProgress = true;
  gdalCheckPromise = (async () => {
    try {
      console.log("Testing GDAL installation (cached check)...");
      
      for (const testPath of GDAL_PATHS) {
        try {
          const cmd = testPath.includes('\\') 
            ? `"${testPath}" --version` 
            : `${testPath} --version`;
          
          const { stdout } = await runCommand(cmd);
          console.log(`✓ GDAL Found: ${stdout.trim()}`);
          console.log(`✓ Using: ${testPath}`);
          
          gdalAvailable = true;
          gdalPath = testPath.includes('\\') ? testPath : null;
          return true;
        } catch (error) {
          // Continue to next path
        }
      }
      
      console.error("✗ GDAL not found in any location");
      gdalAvailable = false;
      return false;
    } catch (error) {
      console.error("✗ GDAL test error:", error.message);
      gdalAvailable = false;
      return false;
    } finally {
      gdalCheckInProgress = false;
    }
  })();

  return gdalCheckPromise;
}

// --- Helper: Update coupe_village_master (OPTIMIZED) ---
async function updateVillageMaster(tableName, replace = false) {
  try {
    const transaction = await sequelize.transaction();
    
    try {
      if (replace) {
        await sequelize.query(
          `DELETE FROM coupe_village_master WHERE coupe_name = $1`,
          { bind: [tableName], transaction }
        );
        console.log(`Deleted old entries for ${tableName} from coupe_village_master`);
      }
      
      const [villages] = await sequelize.query(
        `SELECT DISTINCT village FROM "${tableName}" WHERE village IS NOT NULL AND TRIM(village) != ''`,
        { transaction }
      );
      
      if (villages.length === 0) {
        await transaction.commit();
        return 0;
      }

      const villageNames = villages.map(row => row.village);
      const placeholders = villageNames.map((_, i) => `($1, $${i + 2})`).join(',');
      
      const query = `
        INSERT INTO coupe_village_master (coupe_name, village_name) 
        VALUES ${placeholders}
        ON CONFLICT (coupe_name, village_name) DO NOTHING
      `;
      
      await sequelize.query(query, {
        bind: [tableName, ...villageNames],
        transaction
      });
      
      await transaction.commit();
      console.log(`Inserted ${villages.length} villages for ${tableName} (bulk insert)`);
      return villages.length;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Error updating village master:", err.message);
    return 0;
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

          <PolygonSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
              <CssParameter name="stroke-opacity">1.0</CssParameter>
            </Stroke>
          </PolygonSymbolizer>

          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
              <CssParameter name="stroke-opacity">1.0</CssParameter>
            </Stroke>
          </LineSymbolizer>

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

// --- Fix PostgreSQL table for GeoServer (OPTIMIZED) ---
async function fixPostgreSQLTable(tableName) {
  try {
    const env = { ...process.env, PGPASSWORD: PG_PASS };
    const lowerTable = tableName.toLowerCase();

    console.log(`Fixing PostgreSQL table: ${lowerTable}`);

    const fixCmd = `
      DO \$\$
      DECLARE
        has_fid boolean;
        geom_column text;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='${lowerTable}' AND column_name='fid'
        ) INTO has_fid;
        
        IF NOT has_fid THEN
          ALTER TABLE ${lowerTable} ADD COLUMN fid SERIAL PRIMARY KEY;
          RAISE NOTICE 'Added fid column';
        END IF;

        SELECT column_name INTO geom_column FROM information_schema.columns 
        WHERE table_name='${lowerTable}' AND column_name IN ('wkb_geometry', 'geom', 'geometry')
        LIMIT 1;

        IF geom_column = 'wkb_geometry' THEN
          ALTER TABLE ${lowerTable} RENAME COLUMN wkb_geometry TO geom;
          RAISE NOTICE 'Renamed wkb_geometry to geom';
        ELSIF geom_column = 'geometry' THEN
          ALTER TABLE ${lowerTable} RENAME COLUMN geometry TO geom;
          RAISE NOTICE 'Renamed geometry to geom';
        END IF;

        CREATE INDEX IF NOT EXISTS idx_${lowerTable}_geom ON ${lowerTable} USING GIST (geom);
        PERFORM UpdateGeometrySRID('${lowerTable}', 'geom', 4326);
        
        RAISE NOTICE 'Table ${lowerTable} fixed successfully';
      END \$\$;
    `;

    await runCommand(`psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "${fixCmd}"`, env);
    
    console.log(`PostgreSQL table ${lowerTable} fixed successfully`);
    return true;
  } catch (error) {
    console.error("Error fixing PostgreSQL table:", error.stderr || error.message);
    return false;
  }
}

// --- Publish to GeoServer (OPTIMIZED) ---
async function publishToGeoServer(tableName, color) {
  try {
    const lowerTable = tableName.toLowerCase();
    console.log(`Publishing ${lowerTable} to GeoServer...`);

    const auth = { username: GEOSERVER_USER, password: GEOSERVER_PASS };
    const headers = { "Content-Type": "text/xml" };

    // Check if feature type exists first
    try {
      await axios.get(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes/${lowerTable}`, { auth });
      console.log(`Feature type ${lowerTable} already exists, skipping creation`);
    } catch (error) {
      if (error.response?.status === 404) {
        const xml = `
      <featureType>
  <name>${lowerTable}</name>
  <nativeName>${lowerTable}</nativeName>
  <title>${lowerTable}</title>
  <srs>EPSG:4326</srs>
  <nativeCRS>EPSG:4326</nativeCRS>
  <projectionPolicy>FORCE_DECLARED</projectionPolicy>
  <enabled>true</enabled>
</featureType>
`;

        await axios.post(
          `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`,
          xml,
          { auth, headers }
        );
        console.log(`Created feature type ${lowerTable}`);
      } else {
        throw error;
      }
    }

    // Handle style
    const styleName = `${lowerTable}_style`;
    const sld = generateSLD(lowerTable, color);

    try {
      await axios.put(
        `${GEOSERVER_URL}/rest/styles/${styleName}`,
        sld,
        { auth, headers: { "Content-Type": "application/vnd.ogc.sld+xml" } }
      );
      console.log(`Style ${styleName} updated`);
    } catch (error) {
      if (error.response?.status === 404) {
        await axios.post(
          `${GEOSERVER_URL}/rest/styles?name=${styleName}`,
          sld,
          { auth, headers: { "Content-Type": "application/vnd.ogc.sld+xml" } }
        );
        console.log(`Style ${styleName} created`);
      } else {
        throw error;
      }
    }

    // Apply style
    await axios.put(
      `${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${lowerTable}`,
      `<layer><defaultStyle><name>${styleName}</name></defaultStyle></layer>`,
      { auth, headers: { "Content-Type": "application/xml" } }
    );

    console.log(`Published ${lowerTable} to GeoServer successfully`);
    return true;
  } catch (error) {
    console.error("GeoServer publish error:", error.response?.data || error.message);
    throw error;
  }
}

// --- Upload shapefile route (FIXED) ---
router.post("/upload-shp", upload.array("files"), async (req, res) => {
  let uploadedFiles = [];
  
  try {
    // Quick GDAL check using cached result
    const gdalAvailable = await getGDALAvailability();
    if (!gdalAvailable) {
      return res.status(500).json({
        success: false,
        message: "GDAL not available. Please install GDAL and add to PATH.",
        details: "Run 'ogr2ogr --version' in command prompt to verify installation"
      });
    }

    const color = req.body.color || "#0000ff";
    const targetCoupe = req.body.coupe_name;

    const shpFile = req.files.find(f => f.originalname.endsWith(".shp"));
    if (!shpFile) {
      return res.status(400).json({ success: false, message: "No shapefile (.shp) found" });
    }

    uploadedFiles = req.files;

    let tableName;
    if (targetCoupe) {
      tableName = targetCoupe.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    } else {
      const originalTableName = path.basename(shpFile.originalname, ".shp");
      tableName = originalTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    }

    const shpPath = path.join(UPLOAD_DIR, shpFile.originalname);
    console.log(`========================================`);
    console.log(`Processing shapefile for table: ${tableName}`);
    console.log(`Color: ${color}`);
    console.log(`Edit mode: ${targetCoupe ? 'YES' : 'NO'}`);
    console.log(`========================================`);

    // Quick field validation if needed
    if (targetCoupe) {
      console.log("Validating shapefile attributes...");
      const layerName = path.basename(shpFile.originalname, ".shp");
      const fieldCheckCmd = `ogrinfo -so "${shpPath}" "${layerName}"`;
      
      try {
        const { stdout } = await runCommand(fieldCheckCmd);
        const requiredFields = ['village', 'range', 'round', 'beat', 'division', 'coupe_no'];
        const missingFields = [];
        
        for (const field of requiredFields) {
          if (!stdout.toLowerCase().includes(field.toLowerCase() + ':')) {
            missingFields.push(field);
          }
        }
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        console.log("✓ All required fields present");
      } catch (err) {
        throw err;
      }
    }

    // Handle existing table (rename to backup)
    if (targetCoupe) {
      const env = { ...process.env, PGPASSWORD: PG_PASS };
      const checkTableCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT to_regclass('${tableName}');"`;
      const { stdout } = await runCommand(checkTableCmd, env);
      
      if (stdout.trim() && stdout.trim() !== '(null)') {
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '_').slice(0,19);
        const oldTableName = `${tableName}_old_${timestamp}`;
        console.log(`Renaming existing table ${tableName} to ${oldTableName}`);
        
        const renameCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -c "ALTER TABLE ${tableName} RENAME TO ${oldTableName};"`;
        await runCommand(renameCmd, env);
        
        // Verify rename succeeded
        const verifyCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT to_regclass('${oldTableName}');"`;
        const { stdout: verifyOut } = await runCommand(verifyCmd, env);
        if (!verifyOut.trim() || verifyOut.trim() === '(null)') {
          throw new Error(`Rename of ${tableName} to ${oldTableName} failed – old table not found.`);
        }
        console.log(`✓ Successfully renamed ${tableName} to ${oldTableName}`);
      } else {
        console.log(`Table ${tableName} does not exist, no need to rename.`);
      }
    }

    // Import shapefile to PostgreSQL – using PROMOTE_TO_MULTI to handle mixed geometry types
    console.log(`\n[1/5] Importing shapefile to PostgreSQL...`);
    const ogrCmd = `ogr2ogr -f "PostgreSQL" "PG:host=${PG_HOST} user=${PG_USER} password=${PG_PASS} dbname=${PG_DB} port=5432" "${shpPath}" 
   -nln "${tableName}" -nlt PROMOTE_TO_MULTI -dim 2 -lco GEOMETRY_NAME=geom -lco FID=fid --config PG_USE_COPY YES -progress`;

    const ogrResult = await runCommand(ogrCmd);
    console.log(`✓ Shapefile imported to PostgreSQL table: ${tableName}`);

    // Reduced wait time (2 seconds)
    console.log(`\n[2/5] Waiting for table creation to complete...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fix PostgreSQL table (now optimized with single command)
    console.log(`\n[3/5] Fixing PostgreSQL table for GeoServer...`);
    const tableFixed = await fixPostgreSQLTable(tableName);

    // Publish to GeoServer
    console.log(`\n[4/5] Publishing to GeoServer...`);
    try {
      await publishToGeoServer(tableName, color);
      console.log(`✓ Published to GeoServer successfully`);
    } catch (geoServerError) {
      console.error("GeoServer publish failed:", geoServerError.message);
      // Don't fail the whole process if GeoServer publish fails
    }

    // Update village master (optimized with bulk insert)
    console.log(`\n[5/5] Updating coupe_village_master...`);
    const villageInserted = await updateVillageMaster(tableName, !!targetCoupe);
    console.log(`Village master updated. Inserted ${villageInserted} villages.`);

    // Cleanup uploaded files (async to not block response)
    console.log(`\nCleaning up uploaded files...`);
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.warn(`⚠ Failed to delete ${filePath}:`, err.message);
          else console.log(`✓ Deleted: ${file.originalname}`);
        });
      }
    });

    console.log(`\n✅ Upload process completed successfully!`);
    console.log(`========================================`);

    res.json({
      success: true,
      message: targetCoupe 
        ? `Shapefile uploaded and replaced '${targetCoupe}' successfully` 
        : "Shapefile uploaded & published successfully",
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
    // Improved error handling
    const errorMessage = err.err?.message || err.message || "Unknown error";
    const stderr = err.stderr || (err.err?.stderr);
    const stdout = err.stdout || (err.err?.stdout);
    
    console.error("\n❌ Upload error occurred:", errorMessage);
    if (stderr) console.error("Stderr:", stderr.substring(0, 1000));
    if (stdout) console.error("Stdout:", stdout.substring(0, 500));
    
    // Cleanup files on error
    uploadedFiles.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file.originalname);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: errorMessage,
      details: {
        stderr: stderr ? stderr.substring(0, 500) : null,
        stdout: stdout ? stdout.substring(0, 500) : null
      }
    });
  }
});

// --- Test endpoint (OPTIMIZED) ---
router.get("/test-gdal", async (req, res) => {
  try {
    const gdalAvailable = await getGDALAvailability(true);
    
    if (gdalAvailable) {
      const env = { ...process.env, PGPASSWORD: PG_PASS };
      const testCmd = `psql -h ${PG_HOST} -U ${PG_USER} -d ${PG_DB} -w -t -c "SELECT version();"`;
      
      try {
        const { stdout } = await runCommand(testCmd, env);
        
        res.json({
          success: true,
          gdal: "Available",
          gdalPath: gdalPath || "system PATH",
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

// --- Get admin coupes (OPTIMIZED) ---
router.get('/admincoupes', verifyJwt, async (req, res) => {
  try {
    const [result] = await sequelize.query(
      `SELECT DISTINCT coupe_name FROM public.coupe_village_master ORDER BY coupe_name`,
    );

    res.json({ 
      success: true,
      data: result,
      count: result.length
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