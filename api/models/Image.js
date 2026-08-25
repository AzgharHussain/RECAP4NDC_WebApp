const mongoose = require('../config/mongo').mongoose;

const imageSchema = new mongoose.Schema(
  {
    imageId: {
      type: Number,
      unique: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['patrol', 'ndvi'],
      required: true,
      index: true,
    },
    patrolId: {
      type: Number,
      index: true,
      default: null,
    },
    coupeName: {
      type: String,
      index: true,
      default: null,
    },
    recordId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
      default: null,
    },
    imageCategory: {
      type: String,
      default: null,
    },
    imageType: {
      type: String,
      required: true,
    },
    imageData: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

imageSchema.index({ sourceType: 1, patrolId: 1 });
imageSchema.index({ sourceType: 1, coupeName: 1, recordId: 1 });

imageSchema.pre('save', async function (next) {
  if (!this.imageId) {
    const lastDoc = await this.constructor.findOne({}, {}, { sort: { imageId: -1 } });
    this.imageId = lastDoc && lastDoc.imageId ? lastDoc.imageId + 1 : 1;
  }
  next();
});

const Image = mongoose.model('Image', imageSchema);

// On startup, ensure every patrol image has a `note` field.
// Also migrate any legacy `notes` field into `note` for consistency.
Image.ensurePatrolNotesField = async function () {
  // 1. Add `note` field (default null) to any patrol image missing it
  const addResult = await this.updateMany(
    { sourceType: 'patrol', note: { $exists: false } },
    [{ $set: { note: { $ifNull: ['$note', null] } } }]
  );

  // 2. Migrate legacy `notes` field into `note` if `note` is empty
  const migrateResult = await this.updateMany(
    { sourceType: 'patrol', note: null, notes: { $type: 'string', $ne: '' } },
    [{ $set: { note: '$notes' } }]
  );

  // 3. Remove the legacy `notes` field from all patrol images
  const unsetResult = await this.updateMany(
    { sourceType: 'patrol', notes: { $exists: true } },
    { $unset: { notes: '' } }
  );

  console.log(`[Image.notes migration] added note field to ${addResult.modifiedCount} image(s), migrated notes->note for ${migrateResult.modifiedCount} image(s), removed legacy notes field from ${unsetResult.modifiedCount} image(s)`);
};

module.exports = Image;
