const mongoose = require('../config/mongo').mongoose;

const auditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: Number,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN',
        'LOGIN_FAILED',
        'LOGOUT',
        'LOGOUT_FAILED',
        'PASSWORD_CHANGE',
        'PASSWORD_CHANGE_FAILED',
        'RECORD_CREATE',
        'RECORD_UPDATE',
        'RECORD_DELETE',
        'FILE_UPLOAD',
        'FILE_UPLOAD_FAILED',
        'BOUNDARY_CREATE',
        'BOUNDARY_UPDATE',
        'BOUNDARY_DELETE',
        'NOTIFICATION_SUBSCRIBE',
        'NOTIFICATION_UPDATE',
        'NOTIFICATION_UNSUBSCRIBE',
        'ADMIN_ACTION',
        'API_ACCESS',
        'API_ERROR',
      ],
      index: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    username: {
      type: String,
      default: null,
      index: true,
    },
    userRole: {
      type: String,
      default: null,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    resourceType: {
      type: String,
      default: null,
    },
    resourceId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'ERROR'],
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retentionCategory: {
      type: String,
      enum: ['SYSTEM_EVENT', 'TRANSACTIONAL', 'WEB_PORTAL'],
      default: 'SYSTEM_EVENT',
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  }
);

auditLogSchema.index({ action: 1, status: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

auditLogSchema.pre('save', async function (next) {
  if (!this.logId) {
    const lastDoc = await this.constructor.findOne({}, {}, { sort: { logId: -1 } });
    this.logId = lastDoc && lastDoc.logId ? lastDoc.logId + 1 : 1;
  }
  next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
