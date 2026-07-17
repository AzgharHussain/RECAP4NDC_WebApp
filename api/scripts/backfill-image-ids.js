/**
 * Backfill imageId for existing MongoDB Image documents that don't have one.
 *
 * Usage: node scripts/backfill-image-ids.js
 */
const { connectMongo } = require('../config/mongo');
const MongoImage = require('../models/Image');

async function main() {
  console.log('Connecting to MongoDB...');
  await connectMongo();

  const docs = await MongoImage.find({ imageId: { $exists: false } }).sort({ _id: 1 });
  console.log(`Found ${docs.length} documents without imageId`);

  let counter = 0;
  const lastDoc = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
  let nextId = lastDoc && lastDoc.imageId ? lastDoc.imageId + 1 : 1;

  for (const doc of docs) {
    doc.imageId = nextId++;
    await doc.save();
    counter++;
    if (counter % 100 === 0) {
      console.log(`  Backfilled ${counter}/${docs.length}`);
    }
  }

  console.log(`Done! Backfilled ${counter} documents with imageId.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
