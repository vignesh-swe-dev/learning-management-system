const ActivityLog = require('../models/ActivityLog');

// Never pass passwords or tokens in `meta`.
async function logActivity({ user, course, action, entityType, entityId, meta, isAudit = false, ip }) {
  try {
    await ActivityLog.create({ user, course, action, entityType, entityId, meta, isAudit, ip });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}
module.exports = { logActivity };
