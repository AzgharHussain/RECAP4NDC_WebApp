const { Client } = require("pg");
const axios = require("axios");
const https = require("https");
const fs = require("fs");
const { exec } = require("child_process");
const express = require('express');
const router = express.Router();

// ========== CONFIGURATION ==========
const pgConfig = {
  user: "postgres",
  host: "68.178.167.39",
  database: "Recap4NDC",
  password: "DB@$ecure#25",
  port: 5432,
};

const geoserver = {
  url: "https://gisfy.co.in:8443/geoserver/rest",
  workspace: "cite",
  datastore: "Recap4NDC_DB",
  auth: {
    username: "admin",
    password: "geoserver",
  },
  sld: "Arvalli_Coupe",
};

const qgisPath = `"C:\\Program Files\\QGIS 3.44.2\\bin\\python-qgis.bat"`;

// ========== AXIOS INSTANCE ==========
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 30000,
  auth: geoserver.auth,
});

// ========== HELPER FUNCTIONS ==========

// Publish view to GeoServer
async function publishToGeoServer(viewName) {
  const xmlData = `
    <featureType>
      <name>${viewName}</name>
      <title>${viewName}</title>
      <srs>EPSG:4326</srs>
    </featureType>
  `;
  const publishUrl = `${geoserver.url}/workspaces/${geoserver.workspace}/datastores/${geoserver.datastore}/featuretypes`;

  try {
    const response = await axiosInstance.post(publishUrl, xmlData, {
      headers: { "Content-Type": "text/xml" },
    });
    console.log(`✅ Published ${viewName} to GeoServer (Status: ${response.status})`);
    return true;
  } catch (err) {
    console.error(`❌ GeoServer publish failed for ${viewName}: ${err.message}`);
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Data:", err.response.data);
    }
    return false;
  }
}

// Apply SLD style to layer
async function applySLDToLayer(viewName) {
  try {
    const styleUrl = `${geoserver.url}/layers/${geoserver.workspace}:${viewName}`;
    await axiosInstance.put(
      styleUrl,
      `<layer><defaultStyle><name>${geoserver.sld}</name></defaultStyle></layer>`,
      { headers: { "Content-Type": "application/xml" } }
    );
    console.log(`🎨 Applied SLD: ${geoserver.sld}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to apply SLD for ${viewName}: ${err.message}`);
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Data:", err.response.data);
    }
    return false;
  }
}

// Upload SLD to GeoServer
async function uploadSLDToGeoServer(viewName, sldFilePath) {
  const sldData = fs.readFileSync(sldFilePath, "utf8");
  const sldUrl = `${geoserver.url}/workspaces/${geoserver.workspace}/styles?name=${viewName}_style`;

  try {
    await axiosInstance.post(sldUrl, sldData, {
      headers: { "Content-Type": "application/vnd.ogc.sld+xml" },
    });
    console.log(`✅ Uploaded SLD for ${viewName}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to upload SLD for ${viewName}: ${err.message}`);
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Data:", err.response.data);
    }
    return false;
  }
}

// Style layer in QGIS
async function styleLayerInQGIS(viewName) {
  return new Promise((resolve, reject) => {
    const qgisScript = `
      from qgis.core import QgsProject, QgsVectorLayer, QgsLineSymbol, QgsRuleBasedRenderer
      uri = "dbname='Recap4NDC' host=68.178.167.39 port=5432 user='postgres' password='DB@$ecure#25' key='global_id' table=\\"public\\".\\"${viewName}\\" (geom) sql="
      layer = QgsVectorLayer(uri, "${viewName}_layer", "postgres")
      if not layer.isValid():
          print("Layer failed to load!")
          exit(1)
      symbol = QgsLineSymbol.createSimple({'color': 'red', 'width': '0.5'})
      renderer = QgsRuleBasedRenderer(symbol)
      layer.setRenderer(renderer)
      layer.saveNamedStyle("${viewName}.sld", True)
      print("Style saved as ${viewName}.sld")
    `;
    fs.writeFileSync("temp_style_script.py", qgisScript);
    exec(`${qgisPath} temp_style_script.py`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ QGIS styling failed: ${error}`);
        reject(error);
      } else {
        console.log(`✅ QGIS styling completed for ${viewName}`);
        resolve(`${viewName}.sld`);
      }
    });
  });
}

// Check if view exists in database
async function viewExists(pgClient, viewName) {
  try {
    const result = await pgClient.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = $1
      )`,
      [viewName]
    );
    return result.rows[0].exists;
  } catch (err) {
    console.error(`⚠️ Error checking if view ${viewName} exists: ${err.message}`);
    return false;
  }
}

// Create view in PostgreSQL
async function createViewInPostgreSQL(pgClient, viewName, beats) {
  try {
    const createViewSQL = `
      CREATE OR REPLACE VIEW "${viewName}" AS
      SELECT * FROM public.merged_coupe_filter1
      WHERE "beat" = '${beats}'
    `;
    await pgClient.query(createViewSQL);
    console.log(`✅ View ${viewName} created successfully.`);
    return true;
  } catch (err) {
    console.error(`❌ Error creating view ${viewName}: ${err.message}`);
    return false;
  }
}

// ========== MAIN EXECUTION ==========
(async () => {
  const pgClient = new Client(pgConfig);
  await pgClient.connect();
  console.log("✅ Connected to PostgreSQL");

  // Example beats (replace with dynamic fetch)
  const beats = ["beat1", "beat2"];

  for (const beat of beats) {
    const viewName = `${beat.replace(/\s+/g, "_")}_view`;

    // 1. Create view in PostgreSQL
    const viewCreated = await createViewInPostgreSQL(pgClient, viewName, beat);
    if (!viewCreated) continue;

    // 2. Style layer in QGIS
    const sldFile = await styleLayerInQGIS(viewName);

    // 3. Publish to GeoServer
    const publishSuccess = await publishToGeoServer(viewName);
    if (!publishSuccess) continue;

    // 4. Upload SLD and apply style
    await uploadSLDToGeoServer(viewName, sldFile);
    await applySLDToLayer(viewName);
  }

  await pgClient.end();
  console.log("🔚 Process completed.");
})();
