const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Discussion, Reply } = require('../models');
const { parsePagination } = require('../utils/pagination');
const { loadCourse, isManager, requireStudentAccess } = require('../services/courseAccess');
const { notify } = require('../services/notify');
const realtime = require('../services/realtime');
const { logActivity } = require('../services/audit');

// Course members only: managers of the course, or students enrolled in it. Parents are not members.
async function requireMember(user, courseId) {
  const course = await loadCourse(courseId);
  if (isManager(user, course)) return { course, manager: true };
  if (user.role !== 'student') throw new ApiError(403, 'Only enrolled students and course staff can use this discussion board');
  await requireStudentAccess(user, courseId);
  return { course, manager: false };
}
const brief = (u) => (u ? { _id: u._id, name: u.name, role: u.role } : { name: 'Deleted user' });
const isOwner = (doc, user) => String(doc.author._id || doc.author) === String(user._id);

async function loadThread(id) {
  const t = await Discussion.findById(id).populate('author', 'name role');
  if (!t) throw new ApiError(404, 'Discussion not found');
  return t;
}

exports.list = asyncHandler(async (req, res) => {
  await requireMember(req.user, req.query.courseId);
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { course: req.query.courseId };
  const [rows, total] = await Promise.all([
    Discussion.find(filter).sort({ pinned: -1, lastActivityAt: -1 }).skip(skip).limit(limit).populate('author', 'name role'),
    Discussion.countDocuments(filter),
  ]);
  res.json({ data: rows.map((t) => ({ ...t.toJSON(), author: brief(t.author), body: undefined, preview: t.body.slice(0, 160) })), page, limit, total, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const { course } = await requireMember(req.user, req.body.courseId);
  const { courseId, title, body } = req.body;
  const t = await Discussion.create({ course: courseId, author: req.user._id, title, body });
  realtime.toCourse(courseId, 'discussion:new', { discussionId: t.id, courseId, title });
  realtime.toStaff(courseId, 'discussion:new', { discussionId: t.id, courseId, title });
  if (!isManager(req.user, course)) {
    await notify(course.instructors, { title: `New discussion: ${title}`, body: `${req.user.name} started a discussion in ${course.title}`, type: 'discussion', link: `/courses/${courseId}/discussions/${t.id}`, createdBy: req.user._id });
  }
  res.status(201).json({ discussion: { ...t.toJSON(), author: brief(req.user) } });
});

exports.getOne = asyncHandler(async (req, res) => {
  const t = await loadThread(req.params.id);
  const { manager } = await requireMember(req.user, t.course);
  const { page, limit, skip } = parsePagination(req.query, 100);
  const [replies, total] = await Promise.all([
    Reply.find({ discussion: t._id }).sort({ createdAt: 1 }).skip(skip).limit(limit).populate('author', 'name role'),
    Reply.countDocuments({ discussion: t._id }),
  ]);
  res.json({
    discussion: { ...t.toJSON(), author: brief(t.author) },
    replies: replies.map((r) => ({ ...r.toJSON(), author: brief(r.author), canDelete: manager || isOwner(r, req.user) })),
    canModerate: manager, canDelete: manager || isOwner(t, req.user), page, limit, total, pages: Math.ceil(total / limit),
  });
});

exports.reply = asyncHandler(async (req, res) => {
  const t = await loadThread(req.params.id);
  const { manager } = await requireMember(req.user, t.course);
  if (t.locked && !manager) throw new ApiError(403, 'This discussion is locked');
  const r = await Reply.create({ discussion: t._id, course: t.course, author: req.user._id, body: req.body.body });
  t.replyCount += 1; t.lastActivityAt = new Date();
  await t.save();
  const payload = { discussionId: t.id, courseId: String(t.course), replyId: r.id };
  realtime.toCourse(t.course, 'discussion:reply', payload);
  realtime.toStaff(t.course, 'discussion:reply', payload);
  if (!isOwner(t, req.user)) {
    await notify([t.author._id], { title: `New reply: ${t.title}`, body: `${req.user.name} replied to your discussion`, type: 'discussion', link: `/courses/${t.course}/discussions/${t.id}`, createdBy: req.user._id });
  }
  res.status(201).json({ reply: { ...r.toJSON(), author: brief(req.user), canDelete: true } });
});

exports.moderate = asyncHandler(async (req, res) => {
  const t = await loadThread(req.params.id);
  const { manager } = await requireMember(req.user, t.course);
  if (!manager) throw new ApiError(403, 'Only course staff can pin or lock discussions');
  Object.assign(t, req.body);
  await t.save();
  realtime.toCourse(t.course, 'discussion:reply', { discussionId: t.id, courseId: String(t.course) });
  res.json({ discussion: { ...t.toJSON(), author: brief(t.author) } });
});

exports.remove = asyncHandler(async (req, res) => {
  const t = await loadThread(req.params.id);
  const { manager } = await requireMember(req.user, t.course);
  if (!manager && !isOwner(t, req.user)) throw new ApiError(403, 'You can only delete your own discussions');
  await Promise.all([Reply.deleteMany({ discussion: t._id }), t.deleteOne()]);
  if (manager && !isOwner(t, req.user)) await logActivity({ user: req.user.id, course: t.course, action: 'discussion.delete', entityType: 'Discussion', entityId: t.id, meta: { title: t.title }, isAudit: true });
  res.status(204).end();
});

exports.removeReply = asyncHandler(async (req, res) => {
  const t = await loadThread(req.params.id);
  const { manager } = await requireMember(req.user, t.course);
  const r = await Reply.findOne({ _id: req.params.replyId, discussion: t._id });
  if (!r) throw new ApiError(404, 'Reply not found');
  if (!manager && !isOwner(r, req.user)) throw new ApiError(403, 'You can only delete your own replies');
  await r.deleteOne();
  t.replyCount = Math.max(0, t.replyCount - 1);
  await t.save();
  res.status(204).end();
});
