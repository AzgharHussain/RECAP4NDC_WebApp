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

module.exports = mongoose.model('Image', imageSchema);
