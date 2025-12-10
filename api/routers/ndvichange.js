const { sequelize } = require('../config/ndvidatabase');

async function createNDVIChangeTable() {
  const tableName = '2025-02-01_Sabarkantha_North_Aravalli_NDVI_Change';
  try {
  

    console.log('🚀 Inserting NDVI change data (this may take time)...');
    console.time('⏱️ Insert Time');
    const [insertResult] = await sequelize.query(`
      INSERT INTO "${tableName}" (
        "february_NDVI",
        "january_NDVI",
        "NDVI_change",
        change_category,
        geom,
        centroid,
        longitude,
        latitude,
        notification_sent
      )
      SELECT
        feb."NDVI_real"::FLOAT AS february_ndvi,
        jan."NDVI_real"::FLOAT AS january_ndvi,
        (feb."NDVI_real" - jan."NDVI_real")::FLOAT AS ndvi_change,
        CASE
          WHEN (feb."NDVI_real" - jan."NDVI_real") < -0.5 THEN 'Degradation'
          ELSE 'No Change'
        END AS change_category,
        jan.geom,
        ST_Centroid(jan.geom) AS centroid,
        ST_X(ST_Centroid(jan.geom)) AS longitude,
        ST_Y(ST_Centroid(jan.geom)) AS latitude,
        FALSE
      FROM public."JAN_SKN" jan
      JOIN public."FEB_SKN" feb
        ON jan.geom && feb.geom
       AND ST_Intersects(jan.geom, feb.geom)
      WHERE
        (feb."NDVI_real" - jan."NDVI_real") < -0.5
        AND ST_IsValid(jan.geom)
        AND ST_IsValid(feb.geom);
    `);
    console.timeEnd('⏱️ Insert Time');
    console.log(`✅ Inserted ${insertResult.rowCount} rows`);

   
    console.log('🎉 NDVI change table populated and indexed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ NDVI change table creation failed');
    console.error(error);
    process.exit(1);
  }
}

createNDVIChangeTable();
