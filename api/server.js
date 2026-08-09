/**
 * Auto-create Beat Views + Publish to GeoServer (with SSL fix)
 * Requirements: npm install pg axios
 */
 
require('dotenv').config();
const { Client } = require("pg");
const axios = require("axios");
const https = require("https");
 
// ========== PostgreSQL CONFIG ==========
const pgClient = new Client({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT),
});
 
// ========== GEOSERVER CONFIG ==========
const geoserver = {
  url:       process.env.GEOSERVER_URL + '/rest',
  workspace: process.env.GEOSERVER_WORKSPACE || 'cite',
  datastore: process.env.GEOSERVER_STORE     || 'Recap4NDC_DB',
  auth: {
    username: process.env.GEOSERVER_USER,
    password: process.env.GEOSERVER_PASSWORD,
  },
  sld: process.env.GEOSERVER_SLD || 'Arvalli_Coupe',
};
 
// Create axios instance with SSL verification disabled
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false // Ignore SSL certificate errors
  }),
  timeout: 30000, // 30 seconds timeout
  auth: geoserver.auth
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
    const publishRes = await axiosInstance.post(publishUrl, xmlData, {
      headers: { "Content-Type": "text/xml" },
    });
 
    return true;
  } catch (err) {
    console.error(`❌ GeoServer publish failed for ${viewName}`);
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Status Text:", err.response.statusText);
      console.error("🔸 Response Data:", err.response.data);
    } else if (err.request) {
      console.error("🚫 No response from GeoServer. Check URL / port / network.");
      console.error("🔸 Error:", err.message);
    } else {
      console.error("⚠️ Axios Error:", err.message);
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
      {
        headers: { "Content-Type": "application/xml" },
      }
    );
 
    return true;
  } catch (err) {
    console.error(`⚠️ Failed to apply SLD for ${viewName}`);
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Data:", err.response.data);
    } else {
      console.error("⚠️ Axios Error:", err.message);
    }
    return false;
  }
}
 
// Check if view exists in database
async function viewExists(viewName) {
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
 
// Check if layer exists in GeoServer
async function layerExistsInGeoServer(viewName) {
  try {
    const layerUrl = `${geoserver.url}/layers/${geoserver.workspace}:${viewName}`;
    await axiosInstance.get(layerUrl);
    return true;
  } catch (err) {
    if (err.response?.status === 404) {
      return false;
    }
    console.error(`⚠️ Error checking layer ${viewName} in GeoServer: ${err.message}`);
    return false;
  }
}
 
// Test GeoServer connection
async function testGeoServerConnection() {
  try {
    const testUrl = `${geoserver.url}/workspaces/${geoserver.workspace}.json`;
    const response = await axiosInstance.get(testUrl);
    return true;
  } catch (err) {
    console.error("❌ GeoServer connection failed:");
    if (err.response) {
      console.error("🔸 Status:", err.response.status);
      console.error("🔸 Data:", err.response.data);
    } else if (err.request) {
      console.error("🔸 No response received. Check:");
      console.error("   - GeoServer is running");
      console.error("   - URL is correct: https://gisfy.co.in:8445");
      console.error("   - Port 8443 is accessible");
      console.error("🔸 Error:", err.message);
    } else {
      console.error("🔸 Setup error:", err.message);
    }
    return false;
  }
}
 
// Check actual column names in tables
async function getColumnNames(tableName) {
  try {
    const result = await pgClient.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = $1
       AND (column_name ILIKE '%beat%' OR column_name = 'Beat')`,
      [tableName]
    );
    return result.rows.map(row => row.column_name);
  } catch (err) {
    console.error(`⚠️ Error checking columns for ${tableName}: ${err.message}`);
    return [];
  }
}
 
// Check if table has geometry column
async function hasGeometryColumn(tableName) {
  try {
    const result = await pgClient.query(
      `SELECT COUNT(*) as count
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = $1
       AND (column_name = 'geom' OR column_name = 'geometry' OR data_type LIKE '%geometry%')`,
      [tableName]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (err) {
    console.error(`⚠️ Error checking geometry for ${tableName}: ${err.message}`);
    return false;
  }
}
 
// ========== MAIN EXECUTION ==========
(async () => {
  const createdViews = [];
  const skippedBeats = [];
 
  try {
    await pgClient.connect();
 
    // Test GeoServer connection first
    const geoServerConnected = await testGeoServerConnection();
    if (!geoServerConnected) {
    }
 
    // STEP 1: Fetch all distinct Beat names with better debugging
    const beatRes = await pgClient.query(`
      SELECT "beat" AS beat_name, COUNT(*) as record_count
      FROM public.merged_coupe_filter1
      WHERE "beat" IS NOT NULL AND "beat" != ''
      GROUP BY "beat"
      ORDER BY "beat"
    `);
 
    beatRes.rows.forEach(row => {
    });
 
    const beats = beatRes.rows.map((r) => r.beat_name.trim());
   
    if (beats.length === 0) {
      return;
    }
 
    // STEP 2: Check available tables and their structure
    const tablesRes = await pgClient.query(`
      SELECT DISTINCT input_table_name
      FROM public.coupe_metadata
      WHERE input_table_name IS NOT NULL
    `);
 
   
    const validTables = [];
    for (const t of tablesRes.rows) {
      const table = t.input_table_name;
      const beatColumns = await getColumnNames(table);
      const hasGeom = await hasGeometryColumn(table);
     
     
      if (beatColumns.length > 0 && hasGeom) {
        validTables.push({
          name: table,
          beatColumns: beatColumns
        });
      }
    }
 
 
    // STEP 3: Process each Beat
    for (const beat of beats) {
      const viewName = beat.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_view";
 
      // Check if we have valid tables to query
      if (validTables.length === 0) {
        skippedBeats.push({beat, reason: "No valid tables with beat columns and geometry"});
        continue;
      }
 
      // 1️⃣ Check if view already exists in database
      const dbViewExists = await viewExists(viewName);
     
      if (dbViewExists) {
        try {
          await pgClient.query(`DROP VIEW IF EXISTS "${viewName}" CASCADE`);
        } catch (err) {
          console.error(`⚠️ Error deleting view ${viewName}: ${err.message}`);
          skippedBeats.push({beat, reason: `Error deleting existing view: ${err.message}`});
          continue;
        }
      }
 
      // 2️⃣ Build SQL union from valid tables
      let unionSqlParts = [];
      let tablesWithData = 0;
 
      for (const tableInfo of validTables) {
        const table = tableInfo.name;
        const beatColumns = tableInfo.beatColumns;
 
        for (const beatColumn of beatColumns) {
          try {
            // Check if this table actually has data for this beat
            const dataCheck = await pgClient.query(
              `SELECT COUNT(*) as count
               FROM public."${table}"
               WHERE "${beatColumn}" = $1`,
              [beat]
            );
 
            const recordCount = parseInt(dataCheck.rows[0].count);
           
            if (recordCount > 0) {
              tablesWithData++;
             
              unionSqlParts.push(`
                SELECT '${table}' AS source_table,
                       id,
                       "${beatColumn}" AS beat_column,
                       geom
                FROM public."${table}"
                WHERE "${beatColumn}" = '${beat.replace(/'/g, "''")}'
              `);
            }
          } catch (err) {
            console.error(`⚠️ Error checking data in ${table}.${beatColumn}: ${err.message}`);
          }
        }
      }
 
      if (unionSqlParts.length === 0) {
        skippedBeats.push({beat, reason: "No data found in any source table"});
        continue;
      }
 
 
      // 3️⃣ Create view in PostgreSQL
      const combinedSQL = unionSqlParts.join(" UNION ALL ");
      const createViewSQL = `
        CREATE OR REPLACE VIEW "${viewName}" AS
        SELECT ROW_NUMBER() OVER () AS global_id, *
        FROM (${combinedSQL}) AS combined_data
      `;
 
      try {
        await pgClient.query(createViewSQL);
        createdViews.push(viewName);
       
        // Verify the view was created and has data
        const verifyRes = await pgClient.query(`SELECT COUNT(*) as count FROM "${viewName}"`);
 
      } catch (err) {
        console.error(`❌ Error creating view ${viewName}: ${err.message}`);
        skippedBeats.push({beat, reason: `Error creating view: ${err.message}`});
        continue;
      }
 
      // 4️⃣ Only proceed with GeoServer if connection is working
      if (geoServerConnected) {
        const geoServerLayerExists = await layerExistsInGeoServer(viewName);
       
        if (!geoServerLayerExists) {
          const publishSuccess = await publishToGeoServer(viewName);
         
          if (publishSuccess) {
            // Apply SLD only if publish was successful
            await applySLDToLayer(viewName);
          } else {
            console.error(`🚫 Failed to publish ${viewName} to GeoServer`);
          }
        } else {
          await applySLDToLayer(viewName);
        }
      } else {
      }
    }
 
    // FINAL SUMMARY
   
    if (createdViews.length > 0) {
      createdViews.forEach(view => {
      });
    } else {
    }
   
    if (skippedBeats.length > 0) {
      skippedBeats.forEach(skip => {
      });
    }
   
   
    if (createdViews.length === 0) {
    }
 
  } catch (err) {
    console.error("💥 Fatal error:", err.message);
    console.error(err.stack);
  } finally {
    await pgClient.end();
  }
})();
 