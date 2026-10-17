const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Notification, User } = require('../models');
const { parsePagination } = require('../utils/pagination');
const { notify, enrolledStudentIds } = require('../services/notify');
const { requireManager } = require('../services/courseAccess');
const { logActivity } = require('../services/audit');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user._id, ...(req.query.unread ? { readAt: { $exists: false } } : {}) };
  const [data, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }),
  ]);
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit), unreadCount });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { readAt: new Date() }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found');
  res.json({ notification: n });
});

exports.readAll = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ user: req.user._id, readAt: { $exists: false } }, { readAt: new Date() });
  res.json({ updated: r.modifiedCount });
});

// Instructors announce to the students of a course they teach. Admins can also announce to everyone.
exports.announce = asyncHandler(async (req, res) => {
  const { courseId, title, body } = req.body;
  let recipients;
  if (courseId) {
    await requireManager(req.user, courseId);
    recipients = await enrolledStudentIds(courseId);
  } else {
    if (req.user.role !== 'admin') throw new ApiError(400, 'Choose a course to send this announcement to');
    recipients = (await User.find({ status: 'active', _id: { $ne: req.user._id } }, '_id')).map((u) => u._id);
  }
  const docs = await notify(recipients, { title, body, type: 'announcement', createdBy: req.user._id, link: courseId ? `/courses/${courseId}` : undefined });
  await logActivity({ user: req.user.id, course: courseId, action: 'announcement.send', meta: { recipients: docs.length }, isAudit: req.user.role === 'admin', ip: req.ip });
  res.status(201).json({ sent: docs.length });
});
