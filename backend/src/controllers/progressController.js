const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Lesson, LessonProgress, Enrollment } = require('../models');
const { requireStudentAccess, isManager, loadCourse } = require('../services/courseAccess');
const { courseProgress, refreshCompletion } = require('../services/progress');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');
const { parsePagination } = require('../utils/pagination');

const COMPLETION_THRESHOLD = 0.9; // share of a video that must be watched
const SPEED_ALLOWANCE = 2.5; // watch time may grow this much faster than the clock (2x playback plus slack)
const SLACK_SEC = 5;

// Records a student's progress in a lesson. Everything the client reports is checked on the server.
exports.recordLesson = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students record learning progress');
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  await requireStudentAccess(req.user, lesson.course);

  const now = new Date();
  let row = await LessonProgress.findOne({ student: req.user._id, lesson: lesson._id });
  if (!row) {
    row = new LessonProgress({ student: req.user._id, lesson: lesson._id, course: lesson.course, status: 'in_progress', startedAt: now, lastReportedAt: now });
  }
  const { watchedSec, positionSec, completed } = req.body;
  const cap = lesson.durationSec || Infinity;

  if (watchedSec !== undefined) {
    const elapsed = Math.max(0, (now - (row.lastReportedAt || now)) / 1000);
    const ceiling = row.watchedSec + elapsed * SPEED_ALLOWANCE + SLACK_SEC;
    row.watchedSec = Math.min(Math.max(row.watchedSec, watchedSec), ceiling, cap); // never goes down, never outruns the clock
  }
  if (positionSec !== undefined) row.lastPositionSec = Math.min(positionSec, cap);
  row.lastReportedAt = now;

  let justCompleted = false;
  if (completed && row.status !== 'completed') {
    if (lesson.type === 'video' && lesson.durationSec > 0 && row.watchedSec < lesson.durationSec * COMPLETION_THRESHOLD) {
      await row.save(); // keep the legitimate progress even though completion is refused
      throw new ApiError(400, `Watch at least ${Math.round(COMPLETION_THRESHOLD * 100)}% of the video to mark it complete`);
    }
    row.status = 'completed';
    row.completedAt = now;
    justCompleted = true;
  } else if (row.status === 'not_started') {
    row.status = 'in_progress';
  }
  await row.save();

  if (justCompleted) {
    await logActivity({ user: req.user.id, course: lesson.course, action: 'lesson.completed', entityType: 'Lesson', entityId: lesson.id, meta: { lessonTitle: lesson.title } });
  }
  const p = await refreshCompletion(req.user._id, lesson.course);
  realtime.lessonActivity({ student: req.user, lesson, status: row.status, watchedSec: row.watchedSec, percent: p.percent, justCompleted });
  res.json({
    lesson: { id: lesson.id, status: row.status, watchedSec: row.watchedSec, lastPositionSec: row.lastPositionSec },
    course: { total: p.total, completed: p.completed, percent: p.percent },
  });
});

exports.getCourseProgress = asyncHandler(async (req, res) => {
  const { user } = req;
  const course = await loadCourse(req.params.courseId);
  let studentId;

  if (user.role === 'student') {
    studentId = user._id;
  } else {
    if (!req.query.studentId) throw new ApiError(400, 'studentId is required');
    studentId = req.query.studentId;
    const allowed = user.role === 'parent'
      ? user.linkedStudents.some((id) => id.toString() === studentId)
      : isManager(user, course);
    if (!allowed) throw new ApiError(403, 'You do not have access to this student’s progress');
  }
  const enrollment = await Enrollment.findOne({ student: studentId, course: course._id, status: { $in: ['active', 'completed'] } });
  if (!enrollment) throw new ApiError(user.role === 'student' ? 403 : 404, user.role === 'student' ? 'You are not enrolled in this course' : 'Student is not enrolled in this course');

  const p = await courseProgress(studentId, course._id);
  const lessons = p.lessons.map((l) => {
    const r = p.byLesson.get(l._id.toString());
    return { lessonId: l._id, status: r?.status || 'not_started', watchedSec: r?.watchedSec || 0, lastPositionSec: r?.lastPositionSec || 0, completedAt: r?.completedAt };
  });
  const last = [...p.byLesson.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  res.json({ total: p.total, completed: p.completed, percent: p.percent, lessons, lastLessonId: last?.lesson, enrollmentStatus: enrollment.status });
});

// Per-student completion for a course, for its instructors and admins.
exports.instructorProgress = asyncHandler(async (req, res) => {
  const course = await loadCourse(req.params.courseId);
  if (!isManager(req.user, course)) throw new ApiError(403, 'You do not manage this course');
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { course: course._id, status: { $in: ['active', 'completed'] } };
  const [enrollments, total, lessonTotal] = await Promise.all([
    Enrollment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('student', 'name email'),
    Enrollment.countDocuments(filter),
    Lesson.countDocuments({ course: course._id }),
  ]);
  const enrollmentsAll = enrollments;
  enrollments.splice(0, enrollments.length, ...enrollmentsAll.filter((e) => e.student));
  const stats = await LessonProgress.aggregate([
    { $match: { course: course._id, student: { $in: enrollments.map((e) => e.student._id) } } },
    { $group: { _id: '$student', completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, lastActivityAt: { $max: '$updatedAt' } } },
  ]);
  const byStudent = new Map(stats.map((s) => [s._id.toString(), s]));
  const data = enrollments.map((e) => {
    const s = byStudent.get(e.student._id.toString());
    const completed = s?.completed || 0;
    return {
      student: e.student, status: e.status, enrolledAt: e.createdAt, completed, total: lessonTotal,
      percent: lessonTotal ? Math.round((completed * 100) / lessonTotal) : 0, lastActivityAt: s?.lastActivityAt || null,
    };
  });
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit), lessonTotal });
});
