/**
 * coupe.js — Final HTTPS-only version with PostgreSQL Pool + full TLS and network diagnostics
 */

const express = require("express");
const { Pool } = require("pg");
const shapefile = require("shapefile");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AdmZip = require("adm-zip");
const https = require("https");
const fetch = require("node-fetch"); // ✅ version 2.x

// Create HTTPS agent (ignores self-signed certificate errors)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// ============================
// 🔧 PostgreSQL Pool Configuration
// ============================
const pool = new Pool({
  user: "postgres",
  host: "68.178.167.39",
  database: "Recap4NDC",
  password: "DB@$ecure#25",
  port: 5432,
});

// ============================
// 🌍 GeoServer Configuration
// ============================
const GEOSERVER_URL = "https://gisfy.co.in:8443/geoserver/rest";
const WORKSPACE = "cite";
const DATASTORE = "Recap4NDC_DB"; // Must exactly match your GeoServer datastore name
const GEOSERVER_USER = "admin";
const GEOSERVER_PASS = "geoserver";

// ============================
// 🚀 Upload API Endpoint
// ============================
app.post("/uploadShapefile", upload.single("shapefile"), async (req, res) => {
  const { path: filePath } = req.file;
  const coupeName = req.body.coupeName;

  if (!coupeName)
    return res.status(400).json({ success: false, message: "Coupe name is required." });

  const client = await pool.connect();

  try {
    console.log("✅ PostgreSQL connection acquired from pool");

    const shapefilePath = await unzipShapefile(filePath);
    await createTableForCoupe(client, coupeName);
    const shapefileData = await extractShapefileData(shapefilePath, coupeName);
    await insertShapefileDataToTable(client, coupeName, shapefileData);

    const tableName =
      coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
    const styleName = "Jamnagar_coupes";

    console.log(`🌍 Publishing layer to GeoServer: ${tableName}`);
    await publishLayerWithStyle(tableName, styleName, tableName);

    await insertIntoBeatviewMetadata(client, 1, coupeName, tableName);

    res.status(200).json({
      success: true,
      message: "Shapefile processed successfully.",
      tableName,
    });
  } catch (err) {
    console.error("💥 Fatal error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
    console.log("🔚 PostgreSQL connection released back to pool.");
  }
});

// ============================
// 🧩 Helper Functions
// ============================

// ---- Unzip Uploaded Shapefile ----
async function unzipShapefile(filePath) {
  const unzipDir = path.join("uploads", "shapefiles");
  fs.mkdirSync(unzipDir, { recursive: true });

  const zip = new AdmZip(filePath);
  zip.extractAllTo(unzipDir, true);

  const shpFile = fs.readdirSync(unzipDir).find((f) => f.endsWith(".shp"));
  const dbfFile = fs.readdirSync(unzipDir).find((f) => f.endsWith(".dbf"));

  if (!shpFile || !dbfFile) throw new Error("Missing .shp or .dbf file in ZIP.");

  return { shp: path.join(unzipDir, shpFile), dbf: path.join(unzipDir, dbfFile) };
}

// ---- Extract Shapefile Data ----
async function extractShapefileData(shapefilePath, coupeName) {
  const shapefileData = [];
  const source = await shapefile.open(shapefilePath.shp, shapefilePath.dbf, {
    encoding: "utf-8",
  });
  let result = await source.read();
  while (!result.done) {
    shapefileData.push(result.value);
    result = await source.read();
  }
  console.log(`✅ Extracted ${shapefileData.length} features for ${coupeName}`);
  return shapefileData;
}

// ---- Create PostGIS Table ----
async function createTableForCoupe(client, coupeName) {
  const tableName =
    coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
  const dropSQL = `DROP TABLE IF EXISTS "${tableName}"`;
  const createSQL = `
    CREATE TABLE "${tableName}" (
      id SERIAL PRIMARY KEY,
      geom GEOMETRY(POLYGON, 4326),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX "${tableName}_geom_idx" ON "${tableName}" USING GIST (geom);
  `;
  await client.query(dropSQL);
  await client.query(createSQL);
  console.log(`✅ Table "${tableName}" created.`);
}

// ---- Insert Shapefile Data into Table ----
async function insertShapefileDataToTable(client, coupeName, shapefileData) {
  const tableName =
    coupeName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_table";
  for (const data of shapefileData) {
    if (!data.geometry) continue;
    const insertSQL = `INSERT INTO "${tableName}" (geom) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))`;
    await client.query(insertSQL, [JSON.stringify(data.geometry)]);
  }
  console.log(`✅ Inserted ${shapefileData.length} geometries into "${tableName}".`);
}

// ---- Check if GeoServer Style Exists ----
async function checkStyleExists(styleName) {
  const headers = {
    Accept: "application/json",
    Authorization:
      "Basic " +
      Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
  };
  const url = `${GEOSERVER_URL}/workspaces/${WORKSPACE}/styles/${styleName}.json`;

  try {
    const res = await fetch(url, { method: "GET", headers, agent: httpsAgent });
    if (res.ok) {
      console.log(`✅ Style "${styleName}" found in GeoServer`);
      return true;
    } else if (res.status === 404) {
      console.log(`ℹ️ Style "${styleName}" not found in workspace "${WORKSPACE}"`);
      return false;
    } else {
      const text = await res.text();
      console.error(`❌ Error checking style: ${res.status} ${res.statusText}`);
      console.error(text);
      return false;
    }
  } catch (err) {
    console.error(`❌ HTTPS request failed for style check: ${err.message}`);
    return false;
  }
}

// ---- Publish Layer to GeoServer ----
async function publishLayerWithStyle(tableName, styleName, dbTableName) {
  const styleExists = await checkStyleExists(styleName);
  const url = `${GEOSERVER_URL}/workspaces/${WORKSPACE}/datastores/${DATASTORE}/featuretypes`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization:
      "Basic " +
      Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
  };

  const body = {
    featureType: {
      name: tableName,
      nativeName: dbTableName,
      title: tableName,
      srs: "EPSG:4326",
      enabled: true,
      ...(styleExists && { defaultStyle: { name: styleName } }),
    },
  };

  try {
    console.log(`📤 Publishing layer "${tableName}" to: ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      agent: httpsAgent,
    });

    const text = await res.text();

    if (!res.ok) {
      console.error(`❌ GeoServer responded with status ${res.status} ${res.statusText}`);
      console.error("📄 Response Body:\n", text);
      return false;
    }

    if (text.includes("already exists")) {
      console.log(`⚠️ Layer "${tableName}" already exists in GeoServer.`);
      return true;
    }

    console.log(`✅ Layer "${tableName}" published successfully to GeoServer.`);
    return true;
  } catch (err) {
    console.error("💥 Network/TLS error during layer publish:");
    console.error(err);
    console.error(`🔍 Check connectivity to: ${url}`);
    return false;
  }
}

// ---- Insert Metadata Record ----
async function insertIntoBeatviewMetadata(client, beatId, viewName, tableName) {
  const sql = `
    INSERT INTO public.beatview_metadata (beat_id, beat_name, input_table_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (beat_id) DO NOTHING;
  `;
  await client.query(sql, [beatId, viewName, tableName]);
  console.log(`✅ Inserted into beatview_metadata for ${viewName}`);
}

// ---- GeoServer Health Test ----
app.get("/test-geoserver", async (req, res) => {
  const aboutUrl = `${GEOSERVER_URL}/about/version.json`;
  try {
    const r = await fetch(aboutUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString("base64"),
        Accept: "application/json",
      },
      agent: httpsAgent,
    });
    const body = await r.text();
    res.status(r.ok ? 200 : 500).json({
      status: r.ok ? "GeoServer reachable" : "GeoServer unreachable",
      response: body,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// 🚀 Start Server
// ============================
const PORT = 6000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Using GeoServer (HTTPS): ${GEOSERVER_URL}`);
});
