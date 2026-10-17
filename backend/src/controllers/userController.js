const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');
const { privacyChanged } = require('../services/presenceEvents');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Admins can read anyone; users can read themselves; parents can read linked students.
function canView(actor, targetId) {
  if (actor.role === 'admin' || actor.id === targetId) return true;
  return actor.role === 'parent' && actor.linkedStudents.some((id) => id.toString() === targetId);
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  await logActivity({
    user: req.user.id, action: 'user.create', entityType: 'User', entityId: user.id,
    meta: { role: user.role }, isAudit: true, ip: req.ip,
  });
  res.status(201).json({ user });
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!canView(req.user, req.params.id)) throw new ApiError(403, 'You do not have permission to view this user');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

exports.update = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== req.params.id) {
    throw new ApiError(403, 'You can only edit your own profile');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  // Admin-only fields (role, status, email) are stripped for non-admins by the validator choice below.
  const changes = req.body;
  if (isAdmin && req.user.id === user.id && (changes.role || changes.status)) {
    throw new ApiError(400, 'Admins cannot change their own role or status');
  }
  if (changes.linkedStudents) {
    const ids = [...new Set(changes.linkedStudents)];
    const found = await User.countDocuments({ _id: { $in: ids }, role: 'student' });
    if (found !== ids.length) throw new ApiError(400, 'linkedStudents must all be existing student accounts');
    if ((changes.role || user.role) !== 'parent' && ids.length) throw new ApiError(400, 'Only parent accounts can be linked to students');
    changes.linkedStudents = ids;
  }
  if (changes.role && changes.role !== 'parent' && changes.linkedStudents === undefined) changes.linkedStudents = [];
  Object.assign(user, changes);
  const sensitive = changes.role || changes.status || changes.password;
  if (sensitive) user.tokenVersion += 1; // force re-login with new permissions / password
  await user.save();
  if (sensitive) realtime.disconnectUser(user.id);
  if (changes.shareLiveActivity !== undefined) privacyChanged(user, changes.shareLiveActivity);
  if (isAdmin) {
    await logActivity({
      user: req.user.id, action: 'user.update', entityType: 'User', entityId: user.id,
      meta: { fields: Object.keys(changes).filter((k) => k !== 'password') }, isAudit: true, ip: req.ip,
    });
  }
  res.json({ user });
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.user.id === req.params.id) throw new ApiError(400, 'You cannot delete your own account');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const { Enrollment, LessonProgress, Submission, QuizAttempt, Notification, Certificate, Course, Discussion, Reply, Message } = require('../models');
  const theirThreads = await Discussion.find({ author: user._id }, '_id');
  await Promise.all([
    Enrollment.deleteMany({ student: user._id }), LessonProgress.deleteMany({ student: user._id }),
    Submission.deleteMany({ student: user._id }), QuizAttempt.deleteMany({ student: user._id }),
    Notification.deleteMany({ user: user._id }),
    Message.deleteMany({ $or: [{ sender: user._id }, { recipient: user._id }] }),
    Reply.deleteMany({ $or: [{ author: user._id }, { discussion: { $in: theirThreads.map((t) => t._id) } }] }),
    Discussion.deleteMany({ author: user._id }), Certificate.deleteMany({ student: user._id }),
    Course.updateMany({ instructors: user._id }, { $pull: { instructors: user._id } }),
    User.updateMany({ linkedStudents: user._id }, { $pull: { linkedStudents: user._id } }),
  ]);
  await logActivity({
    user: req.user.id, action: 'user.delete', entityType: 'User', entityId: user.id,
    meta: { role: user.role }, isAudit: true, ip: req.ip,
  });
  res.status(204).end();
});
