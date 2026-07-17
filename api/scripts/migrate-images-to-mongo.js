/**
 * Migration Script: Move base64 images from PostgreSQL to MongoDB
 *
 * Migrates:
 *   1. Patrol images from patrol_images table (Recap4NDC DB)
 *   2. NDVI coupe images from *_coupe_NDVI_Change tables (Recap4NDC_Query DB)
 *
 * Usage: node scripts/migrate-images-to-mongo.js
 */

const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const { connectMongo, mongoose } = require('../config/mongo');
const MongoImage = require('../models/Image');

// ── PostgreSQL client for Recap4NDC (patrol images) ──
const pgClient = new Client({
  host: '68.178.167.216',
  user: 'postgres',
  password: 'P$DB@25%$#!26',
  port: 5432,
  database: 'Recap4NDC',
});

// ── Sequelize for Recap4NDC_Query (NDVI coupe tables) ──
const querySequelize = new Sequelize(
  'Recap4NDC_Query',
  'postgres',
  'pass@123',
  {
    host: '68.178.167.216',
    port: 5435,
    dialect: 'postgres',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

// ── Helpers ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 1. Migrate patrol images ──
async function migratePatrolImages() {
  console.log('\n========== Migrating Patrol Images ==========\n');

  try {
    // Check if patrol_images table exists and has data
    const countResult = await pgClient.query('SELECT COUNT(*) AS total FROM patrol_images');
    const totalCount = parseInt(countResult.rows[0].total);
    console.log(`Found ${totalCount} patrol image records in PostgreSQL`);

    if (totalCount === 0) {
      console.log('No patrol images to migrate. Skipping.');
      return { migrated: 0, skipped: 0 };
    }

    // Check what already exists in MongoDB
    const existingMongo = await MongoImage.countDocuments({ sourceType: 'patrol' });
    console.log(`MongoDB already has ${existingMongo} patrol images`);

    // Fetch all patrol images in batches
    const BATCH_SIZE = 100;
    let offset = 0;
    let migrated = 0;
    let skipped = 0;

    while (offset < totalCount) {
      const result = await pgClient.query(
        `SELECT image_id, image_data, image_type, patrol_id, image_category, note
         FROM patrol_images
         ORDER BY image_id
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      if (result.rows.length === 0) break;

      // Build docs for this batch — skip if image_data is null/empty
      const docs = [];
      let migCounter = 0;
      const baseCount = await MongoImage.countDocuments();
      for (const row of result.rows) {
        if (!row.image_data || row.image_data.trim() === '') {
          skipped++;
          continue;
        }

        // Check if this image already exists in MongoDB (by patrolId + imageCategory)
        const existing = await MongoImage.findOne({
          sourceType: 'patrol',
          patrolId: row.patrol_id,
          imageCategory: row.image_category,
        }).lean();

        if (existing) {
          skipped++;
          continue;
        }

        docs.push({
          imageId: baseCount + migCounter + 1,
          sourceType: 'patrol',
          patrolId: row.patrol_id,
          imageCategory: row.image_category,
          imageType: row.image_type || 'image/jpeg',
          imageData: row.image_data,
          note: row.note || null,
        });
        migCounter++;
      }

      if (docs.length > 0) {
        await MongoImage.insertMany(docs, { ordered: false });
        migrated += docs.length;
        console.log(`  Migrated batch: ${docs.length} images (total so far: ${migrated})`);
      }

      offset += BATCH_SIZE;

      // Small delay to avoid overwhelming MongoDB Atlas
      await sleep(200);
    }

    console.log(`\nPatrol images migration complete: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped };

  } catch (err) {
    console.error('❌ Error migrating patrol images:', err.message);
    throw err;
  }
}

// ── 2. Migrate NDVI coupe images ──
async function migrateNdviImages() {
  console.log('\n========== Migrating NDVI Coupe Images ==========\n');

  try {
    // Get all NDVI Change tables
    const [tablesResult] = await querySequelize.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE '%\\_coupe\\_NDVI\\_Change' ESCAPE '\\'
      ORDER BY tablename;
    `);

    if (!tablesResult || tablesResult.length === 0) {
      console.log('No NDVI Change tables found. Skipping.');
      return { migrated: 0, skipped: 0, tables: 0 };
    }

    console.log(`Found ${tablesResult.length} NDVI Change tables`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const { tablename } of tablesResult) {
      console.log(`\n  Processing table: ${tablename}`);

      try {
        // Check if image_data column exists
        const [colCheck] = await querySequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tablename}'
            AND column_name = 'image_data';
        `);

        if (!colCheck || colCheck.length === 0) {
          console.log(`    No image_data column. Skipping.`);
          continue;
        }

        // Fetch records that have image_data
        const [rows] = await querySequelize.query(`
          SELECT pixle_id, image_data, note
          FROM public."${tablename}"
          WHERE image_data IS NOT NULL AND image_data != '';
        `);

        if (!rows || rows.length === 0) {
          console.log(`    No images in this table. Skipping.`);
          continue;
        }

        console.log(`    Found ${rows.length} records with images`);

        let tableMigrated = 0;
        let tableSkipped = 0;

        for (const row of rows) {
          const recordId = row.pixle_id;
          if (!recordId) {
            tableSkipped++;
            continue;
          }

          // Check if already exists in MongoDB
          const existing = await MongoImage.findOne({
            sourceType: 'ndvi',
            coupeName: tablename,
            recordId: recordId,
          }).lean();

          if (existing) {
            tableSkipped++;
            continue;
          }

          const lastMigImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
          const migId = lastMigImg && lastMigImg.imageId ? lastMigImg.imageId + 1 : 1;
          await MongoImage.create({
            imageId: migId,
            sourceType: 'ndvi',
            coupeName: tablename,
            recordId: recordId,
            imageType: 'image/jpeg',
            imageData: row.image_data,
            note: row.note || null,
          });
          tableMigrated++;
        }

        totalMigrated += tableMigrated;
        totalSkipped += tableSkipped;
        console.log(`    Migrated: ${tableMigrated}, Skipped: ${tableSkipped}`);

        await sleep(200);
      } catch (tableErr) {
        console.error(`    Error processing table ${tablename}:`, tableErr.message);
      }
    }

    console.log(`\nNDVI images migration complete: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    return { migrated: totalMigrated, skipped: totalSkipped, tables: tablesResult.length };

  } catch (err) {
    console.error('❌ Error migrating NDVI images:', err.message);
    throw err;
  }
}

// ── Main ──
async function main() {
  console.log('🚀 Starting migration: PostgreSQL → MongoDB\n');

  // Connect to MongoDB
  const mongoConnected = await connectMongo();
  if (!mongoConnected) {
    console.error('Cannot proceed without MongoDB connection. Exiting.');
    process.exit(1);
  }

  // Connect to PostgreSQL (patrol images)
  await pgClient.connect();
  console.log('✅ Connected to PostgreSQL (Recap4NDC)');

  // Connect to Recap4NDC_Query (NDVI tables)
  await querySequelize.authenticate();
  console.log('✅ Connected to PostgreSQL (Recap4NDC_Query)');

  const patrolResult = await migratePatrolImages();
  const ndviResult = await migrateNdviImages();

  console.log('\n========== Migration Summary ==========');
  console.log(`Patrol images: ${patrolResult.migrated} migrated, ${patrolResult.skipped} skipped`);
  console.log(`NDVI images:   ${ndviResult.migrated} migrated, ${ndviResult.skipped} skipped (${ndviResult.tables} tables scanned)`);
  console.log(`Total:         ${patrolResult.migrated + ndviResult.migrated} migrated, ${patrolResult.skipped + ndviResult.skipped} skipped`);
  console.log('=======================================\n');

  // Cleanup
  await pgClient.end();
  await querySequelize.close();
  await mongoose.disconnect();
  console.log('🔌 Disconnected from all databases. Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
