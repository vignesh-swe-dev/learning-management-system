const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Module, Lesson, LessonProgress } = require('../models');
const { refreshCompletion } = require('../services/progress');
const { Enrollment } = require('../models');
const refreshCourse = async (courseId) => {
  const rows = await Enrollment.find({ course: courseId, status: { $in: ['active', 'completed'] } }, 'student');
  for (const r of rows) await refreshCompletion(r.student, courseId);
};
const { requireManager, isManager, isEnrolled, loadCourse } = require('../services/courseAccess');

const signFileToken = (file) => jwt.sign({ purpose: 'file', file }, env.jwtSecret, { expiresIn: '6h' });

// ---- modules ----
exports.createModule = asyncHandler(async (req, res) => {
  await requireManager(req.user, req.params.courseId);
  const order = await Module.countDocuments({ course: req.params.courseId });
  const mod = await Module.create({ course: req.params.courseId, title: req.body.title, order });
  res.status(201).json({ module: mod });
});

async function moduleForManager(user, id) {
  const mod = await Module.findById(id);
  if (!mod) throw new ApiError(404, 'Module not found');
  await requireManager(user, mod.course);
  return mod;
}

exports.updateModule = asyncHandler(async (req, res) => {
  const mod = await moduleForManager(req.user, req.params.id);
  Object.assign(mod, req.body);
  await mod.save();
  res.json({ module: mod });
});

exports.removeModule = asyncHandler(async (req, res) => {
  const mod = await moduleForManager(req.user, req.params.id);
  const lessons = await Lesson.find({ module: mod._id }, '_id');
  await LessonProgress.deleteMany({ lesson: { $in: lessons.map((l) => l._id) } });
  await Lesson.deleteMany({ module: mod._id });
  await mod.deleteOne();
  await refreshCourse(mod.course);
  res.status(204).end();
});

// ---- lessons ----
exports.createLesson = asyncHandler(async (req, res) => {
  const mod = await moduleForManager(req.user, req.params.moduleId);
  const order = await Lesson.countDocuments({ module: mod._id });
  const lesson = await Lesson.create({ ...req.body, course: mod.course, module: mod._id, order });
  await refreshCourse(mod.course);
  res.status(201).json({ lesson });
});

async function lessonForManager(user, id) {
  const lesson = await Lesson.findById(id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  await requireManager(user, lesson.course);
  return lesson;
}

exports.updateLesson = asyncHandler(async (req, res) => {
  const lesson = await lessonForManager(req.user, req.params.id);
  const next = { ...lesson.toObject(), ...req.body };
  if (next.type === 'text' ? !next.content : !next.resourceUrl) {
    throw new ApiError(400, next.type === 'text' ? 'Text lessons need content' : 'This lesson type needs a file or link');
  }
  Object.assign(lesson, req.body);
  await lesson.save();
  res.json({ lesson });
});

exports.removeLesson = asyncHandler(async (req, res) => {
  const lesson = await lessonForManager(req.user, req.params.id);
  await LessonProgress.deleteMany({ lesson: lesson._id });
  await lesson.deleteOne();
  await refreshCourse(lesson.course);
  res.status(204).end();
});

// Returns what the viewer needs to open a lesson. Uploaded files get a short-lived signed URL.
exports.access = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  const course = await loadCourse(lesson.course);
  const allowed = isManager(req.user, course) || (course.status === 'published' && (await isEnrolled(req.user, course._id)));
  if (!allowed) throw new ApiError(403, 'Enroll in this course to open its lessons');

  const out = { id: lesson.id, title: lesson.title, type: lesson.type, content: lesson.content };
  if (lesson.resourceUrl) {
    const internal = lesson.resourceUrl.startsWith('/api/files/');
    out.external = !internal;
    out.url = internal
      ? `${lesson.resourceUrl}?token=${signFileToken(lesson.resourceUrl.split('/').pop())}`
      : lesson.resourceUrl;
  }
  res.json({ lesson: out });
});
