const mongoose = require('mongoose');
const { Schema } = mongoose;

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

const activityLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    action: { type: String, required: true },
    entityType: String,
    entityId: Schema.Types.ObjectId,
    meta: Schema.Types.Mixed,
    ip: String,
    isAudit: { type: Boolean, default: false }, // audit entries are kept; routine activity expires
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ course: 1, createdAt: -1 });
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_SECONDS, partialFilterExpression: { isAudit: false } }
);
module.exports = mongoose.model('ActivityLog', activityLogSchema);
