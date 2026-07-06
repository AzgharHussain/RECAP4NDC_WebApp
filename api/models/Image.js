const mongoose = require('../config/mongo').mongoose;

const imageSchema = new mongoose.Schema(
  {
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
      type: Number,
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

module.exports = mongoose.model('Image', imageSchema);
