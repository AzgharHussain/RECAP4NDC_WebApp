/**
 * Auto-create Beat Views + Publish to GeoServer (with SSL fix)
 * Requirements: npm install pg axios
 */
 
const { Client } = require("pg");
const axios = require("axios");
const https = require("https");
 
// ========== PostgreSQL CONFIG ==========
const pgClient = new Client({
  user:     process.env.DB_USER     || 'recap4ndc_postgres',
  host:     process.env.DB_HOST     || 'gsdc-psql.gujarat.gov.in',
  database: process.env.DB_NAME     || 'RECAP4NDC',
  password: process.env.DB_PASSWORD || '',
  port:     Number(process.env.DB_PORT || 9999),
});
 
// ========== GEOSERVER CONFIG ==========
const geoserver = {
  url:       process.env.GEOSERVER_URL       || 'http://localhost:8080/geoserver/rest',
  workspace: process.env.GEOSERVER_WORKSPACE || 'cite',
  datastore: process.env.GEOSERVER_STORE     || 'Recap4NDC_DB',
  auth: {
    username: process.env.GEOSERVER_USER     || 'admin',
    password: process.env.GEOSERVER_PASSWORD || 'geoserver',
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
 
  console.log(`🌍 Publishing ${viewName} to GeoServer...`);
 
  try {
    const publishRes = await axiosInstance.post(publishUrl, xmlData, {
      headers: { "Content-Type": "text/xml" },
    });
 
    console.log(`✅ Published ${viewName} → GeoServer (Status: ${publishRes.status})`);
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
 
    console.log(`🎨 Applied default SLD: ${geoserver.sld}`);
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
    console.log("🔗 Testing GeoServer connection...");
    const testUrl = `${geoserver.url}/workspaces/${geoserver.workspace}.json`;
    const response = await axiosInstance.get(testUrl);
    console.log(`✅ GeoServer connection successful (Status: ${response.status})`);
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
    console.log("✅ Connected to PostgreSQL");
 
    // Test GeoServer connection first
    const geoServerConnected = await testGeoServerConnection();
    if (!geoServerConnected) {
      console.log("🚫 Skipping GeoServer operations due to connection issues");
    }
 
    // STEP 1: Fetch all distinct Beat names with better debugging
    console.log("\n🔍 Checking available beats in merged_coupe_filter1...");
    const beatRes = await pgClient.query(`
      SELECT "beat" AS beat_name, COUNT(*) as record_count
      FROM public.merged_coupe_filter1
      WHERE "beat" IS NOT NULL AND "beat" != ''
      GROUP BY "beat"
      ORDER BY "beat"
    `);
 
    console.log(`🔹 Found ${beatRes.rows.length} distinct beats in merged_coupe_filter1:`);
    beatRes.rows.forEach(row => {
      console.log(`   - "${row.beat_name}" (${row.record_count} records)`);
    });
 
    const beats = beatRes.rows.map((r) => r.beat_name.trim());
   
    if (beats.length === 0) {
      console.log("❌ No beats found in merged_coupe_filter1 table!");
      console.log("💡 Please check:");
      console.log("   1. The table 'merged_coupe_filter1' exists");
      console.log("   2. The column 'beat' has data");
      console.log("   3. There are non-null, non-empty beat values");
      return;
    }
 
    // STEP 2: Check available tables and their structure
    console.log("\n🔍 Checking available tables and their structure...");
    const tablesRes = await pgClient.query(`
      SELECT DISTINCT input_table_name
      FROM public.coupe_metadata
      WHERE input_table_name IS NOT NULL
    `);
 
    console.log(`🔹 Found ${tablesRes.rows.length} tables in coupe_metadata:`);
   
    const validTables = [];
    for (const t of tablesRes.rows) {
      const table = t.input_table_name;
      const beatColumns = await getColumnNames(table);
      const hasGeom = await hasGeometryColumn(table);
     
      console.log(`   - ${table}:`);
      console.log(`     Beat columns: [${beatColumns.join(', ')}]`);
      console.log(`     Has geometry: ${hasGeom}`);
     
      if (beatColumns.length > 0 && hasGeom) {
        validTables.push({
          name: table,
          beatColumns: beatColumns
        });
      }
    }
 
    console.log(`\n✅ ${validTables.length} tables have both beat columns and geometry`);
 
    // STEP 3: Process each Beat
    for (const beat of beats) {
      console.log(`\n🚀 Processing Beat: "${beat}"`);
      const viewName = beat.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") + "_view";
 
      // Check if we have valid tables to query
      if (validTables.length === 0) {
        console.log(`❌ No valid tables found for creating views`);
        skippedBeats.push({beat, reason: "No valid tables with beat columns and geometry"});
        continue;
      }
 
      // 1️⃣ Check if view already exists in database
      const dbViewExists = await viewExists(viewName);
     
      if (dbViewExists) {
        console.log(`🗑️ View ${viewName} already exists in DB - deleting...`);
        try {
          await pgClient.query(`DROP VIEW IF EXISTS "${viewName}" CASCADE`);
          console.log(`✅ Deleted existing view: ${viewName}`);
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
              console.log(`   📊 ${table}.${beatColumn}: ${recordCount} records for beat "${beat}"`);
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
        console.log(`❌ No data found for beat "${beat}" in any table`);
        skippedBeats.push({beat, reason: "No data found in any source table"});
        continue;
      }
 
      console.log(`✅ Found data for beat "${beat}" in ${tablesWithData} table(s)`);
 
      // 3️⃣ Create view in PostgreSQL
      const combinedSQL = unionSqlParts.join(" UNION ALL ");
      const createViewSQL = `
        CREATE OR REPLACE VIEW "${viewName}" AS
        SELECT ROW_NUMBER() OVER () AS global_id, *
        FROM (${combinedSQL}) AS combined_data
      `;
 
      try {
        console.log(`🛠️ Creating view: ${viewName}`);
        await pgClient.query(createViewSQL);
        console.log(`✅ View ${viewName} created successfully.`);
        createdViews.push(viewName);
       
        // Verify the view was created and has data
        const verifyRes = await pgClient.query(`SELECT COUNT(*) as count FROM "${viewName}"`);
        console.log(`📊 View ${viewName} contains ${verifyRes.rows[0].count} records`);
 
      } catch (err) {
        console.error(`❌ Error creating view ${viewName}: ${err.message}`);
        skippedBeats.push({beat, reason: `Error creating view: ${err.message}`});
        continue;
      }
 
      // 4️⃣ Only proceed with GeoServer if connection is working
      if (geoServerConnected) {
        const geoServerLayerExists = await layerExistsInGeoServer(viewName);
       
        if (!geoServerLayerExists) {
          console.log(`🌍 Layer ${viewName} not found in GeoServer - publishing...`);
          const publishSuccess = await publishToGeoServer(viewName);
         
          if (publishSuccess) {
            // Apply SLD only if publish was successful
            await applySLDToLayer(viewName);
          } else {
            console.error(`🚫 Failed to publish ${viewName} to GeoServer`);
          }
        } else {
          console.log(`ℹ️ Layer ${viewName} already exists in GeoServer - skipping publish`);
          await applySLDToLayer(viewName);
        }
      } else {
        console.log(`ℹ️ Skipping GeoServer operations for ${viewName} due to connection issues`);
      }
    }
 
    // FINAL SUMMARY
    console.log("\n" + "=".repeat(60));
    console.log("📊 FINAL EXECUTION SUMMARY");
    console.log("=".repeat(60));
   
    if (createdViews.length > 0) {
      console.log(`\n✅ SUCCESSFULLY CREATED VIEWS (${createdViews.length}):`);
      createdViews.forEach(view => {
        console.log(`   • ${view}`);
      });
    } else {
      console.log("\n❌ NO VIEWS WERE CREATED");
    }
   
    if (skippedBeats.length > 0) {
      console.log(`\n⚠️ SKIPPED BEATS (${skippedBeats.length}):`);
      skippedBeats.forEach(skip => {
        console.log(`   • ${skip.beat}: ${skip.reason}`);
      });
    }
   
    console.log(`\n📈 TOTAL PROCESSED: ${beats.length} beats`);
    console.log(`✅ SUCCESS: ${createdViews.length} views created`);
    console.log(`⚠️ SKIPPED: ${skippedBeats.length} beats`);
   
    if (createdViews.length === 0) {
      console.log("\n🔍 TROUBLESHOOTING SUGGESTIONS:");
      console.log("   1. Check if source tables have data for the specified beats");
      console.log("   2. Verify column names in source tables (looking for 'beat' columns)");
      console.log("   3. Check if source tables have geometry columns");
      console.log("   4. Verify beat values match exactly between merged_coupe_filter1 and source tables");
    }
 
  } catch (err) {
    console.error("💥 Fatal error:", err.message);
    console.error(err.stack);
  } finally {
    await pgClient.end();
    console.log("\n🔚 PostgreSQL connection closed.");
  }
})();
 