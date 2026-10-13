const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Course, Module, Lesson, Enrollment, User } = require('../models');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../services/audit');
const { isManager, loadCourse, requireManager } = require('../services/courseAccess');
const { deleteCourseCascade } = require('../services/courseCascade');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, title: { title: 1 } };

async function assertInstructors(ids) {
  if (!ids || !ids.length) return;
  const count = await User.countDocuments({ _id: { $in: ids }, role: 'instructor', status: 'active' });
  if (count !== ids.length) throw new ApiError(400, 'Every assigned instructor must be an active instructor account');
}

exports.list = asyncHandler(async (req, res) => {
  const { user } = req;
  const { page, limit, skip } = parsePagination(req.query);
  const { q, category, level, status, mine, sort } = req.query;

  const and = [];
  if (user.role === 'admin') {
    if (status) and.push({ status });
    if (mine) and.push({ createdBy: user._id });
  } else if (user.role === 'instructor') {
    and.push({ $or: [{ status: 'published' }, { instructors: user._id }] });
    if (status) and.push({ status });
    if (mine) and.push({ instructors: user._id });
  } else {
    and.push({ status: 'published' }); // students and parents never see drafts
  }
  if (category) and.push({ category: new RegExp(`^${escapeRegex(category)}$`, 'i') });
  if (level) and.push({ level });
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { category: rx }] });
  }
  const filter = and.length ? { $and: and } : {};

  const [courses, total, categories] = await Promise.all([
    Course.find(filter).sort(SORTS[sort] || SORTS.newest).skip(skip).limit(limit)
      .populate('instructors', 'name').lean({ virtuals: false }),
    Course.countDocuments(filter),
    Course.distinct('category', user.role === 'admin' ? {} : { status: 'published' }),
  ]);

  const ids = courses.map((c) => c._id);
  const [lessonCounts, enrollCounts, myEnrollments] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { course: { $in: ids }, status: { $ne: 'dropped' } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    user.role === 'student'
      ? Enrollment.find({ student: user._id, course: { $in: ids }, status: { $ne: 'dropped' } }, 'course')
      : [],
  ]);
  const lc = Object.fromEntries(lessonCounts.map((r) => [r._id, r.n]));
  const ec = Object.fromEntries(enrollCounts.map((r) => [r._id, r.n]));
  const mine_ = new Set(myEnrollments.map((e) => e.course.toString()));

  const data = courses.map((c) => ({
    ...c,
    id: c._id,
    lessonCount: lc[c._id] || 0,
    enrollmentCount: ec[c._id] || 0,
    isEnrolled: mine_.has(c._id.toString()),
    canManage: isManager(user, { instructors: c.instructors.map((i) => i._id) }),
  }));
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit), categories: categories.sort() });
});

exports.create = asyncHandler(async (req, res) => {
  const { user } = req;
  const body = { ...req.body };
  if (user.role === 'instructor') {
    if (body.instructors && body.instructors.length) throw new ApiError(403, 'Only an admin can assign instructors');
    body.instructors = [user._id];
  } else {
    await assertInstructors(body.instructors);
  }
  const course = await Course.create({ ...body, status: 'draft', createdBy: user._id });
  await logActivity({ user: user.id, action: 'course.create', entityType: 'Course', entityId: course.id, ip: req.ip });
  res.status(201).json({ course });
});

exports.getOne = asyncHandler(async (req, res) => {
  const { user } = req;
  const course = await loadCourse(req.params.id);
  const manager = isManager(user, course);
  if (course.status !== 'published' && !manager) throw new ApiError(404, 'Course not found'); // do not reveal drafts

  const enrollment = user.role === 'student'
    ? await Enrollment.findOne({ student: user._id, course: course._id, status: { $in: ['active', 'completed'] } })
    : null;
  const enrolled = Boolean(enrollment);
  const canSeeContent = manager || enrolled;
  const [modules, lessons] = await Promise.all([
    Module.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
    Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  await course.populate('instructors', 'name');

  const outline = modules.map((m) => ({
    ...m,
    id: m._id,
    lessons: lessons.filter((l) => l.module.equals(m._id)).map((l) => {
      const { content, resourceUrl, ...meta } = l; // outline only for people without access
      return canSeeContent
        ? { ...l, id: l._id }
        : { ...meta, id: l._id, locked: true };
    }),
  }));
  res.json({ course, modules: outline, access: { canManage: manager, isEnrolled: enrolled, enrollmentId: enrollment?.id, canSeeContent } });
});

exports.update = asyncHandler(async (req, res) => {
  const { user } = req;
  const course = await requireManager(user, req.params.id);
  const changes = { ...req.body };

  if (changes.instructors) {
    if (user.role !== 'admin') throw new ApiError(403, 'Only an admin can assign instructors');
    await assertInstructors(changes.instructors);
  }
  const instructors = changes.instructors || course.instructors;
  if (changes.status === 'published' && course.status !== 'published') {
    if (!instructors.length) throw new ApiError(400, 'Assign at least one instructor before publishing');
    if (!(await Lesson.exists({ course: course._id }))) throw new ApiError(400, 'Add at least one lesson before publishing');
  }
  if (changes.thumbnail === '') changes.thumbnail = undefined;

  const statusChanged = changes.status && changes.status !== course.status;
  Object.assign(course, changes);
  await course.save();
  await logActivity({
    user: user.id, action: statusChanged ? `course.${changes.status}` : 'course.update', entityType: 'Course',
    entityId: course.id, meta: { fields: Object.keys(changes) }, isAudit: user.role === 'admin', ip: req.ip,
  });
  res.json({ course });
});

exports.remove = asyncHandler(async (req, res) => {
  const course = await loadCourse(req.params.id);
  await deleteCourseCascade(course._id);
  await logActivity({
    user: req.user.id, action: 'course.delete', entityType: 'Course', entityId: course.id,
    meta: { title: course.title }, isAudit: true, ip: req.ip,
  });
  res.status(204).end();
});

exports.listEnrollments = asyncHandler(async (req, res) => {
  await requireManager(req.user, req.params.id);
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { course: req.params.id };
  const [data, total] = await Promise.all([
    Enrollment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('student', 'name email'),
    Enrollment.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
});
