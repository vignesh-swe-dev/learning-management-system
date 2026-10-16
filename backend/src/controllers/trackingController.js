const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Course, Lesson, LessonProgress, Enrollment, Assignment, Submission, ActivityLog, Attendance, User } = require('../models');
const presence = require('../services/presence');
const { parsePagination } = require('../utils/pagination');
const { visibleCourseIds } = require('../services/courseAccess');
const { activityBuckets } = require('../services/activityReport');

const FEED_ACTIONS = ['lesson.started', 'lesson.completed', 'assignment.submit', 'quiz.start', 'quiz.submit', 'attendance.join'];
const inScope = (ids) => (ids ? { $in: ids } : { $exists: true });

// Students who are online right now, with the lesson they are viewing. Students who switched off
// "share live activity" are left out and only counted.
exports.activeStudents = asyncHandler(async (req, res) => {
  const ids = await visibleCourseIds(req.user);
  const allowed = ids && new Set(ids.map(String));
  const wanted = req.query.courseId;
  let hiddenCount = 0;
  const data = [];
  for (const e of presence.online()) {
    if (e.role !== 'student') continue;
    const mine = e.courseIds.filter((c) => (!allowed || allowed.has(c)) && (!wanted || c === wanted));
    if (!mine.length) continue;
    if (!e.share) { hiddenCount += 1; continue; }
    data.push({
      student: { id: e.id, name: e.name }, courseId: e.courseId || null, courseTitle: e.courseTitle || null,
      lessonId: e.lessonId || null, lessonTitle: e.lessonTitle || null, onlineSince: e.onlineSince, lastActivityAt: e.lastActivityAt,
    });
  }
  data.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
  res.json({ data, total: data.length, hiddenCount });
});

async function feed(ids, { courseId, page, limit, skip }) {
  const hidden = (await User.find({ role: 'student', shareLiveActivity: false }, '_id')).map((u) => u._id);
  const filter = {
    action: { $in: FEED_ACTIONS },
    course: courseId || inScope(ids),
    // Which lesson someone is viewing is live status: hidden when they opted out. Completions and submissions are learning records.
    $or: [{ action: { $ne: 'lesson.started' } }, { user: { $nin: hidden } }],
  };
  const [rows, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name').populate('course', 'title').lean(),
    ActivityLog.countDocuments(filter),
  ]);
  return { data: rows.map((r) => ({ id: r._id, action: r.action, user: r.user ? { id: r.user._id, name: r.user.name } : null, course: r.course, meta: r.meta, createdAt: r.createdAt })), total, page, limit, pages: Math.ceil(total / limit) };
}

exports.activity = asyncHandler(async (req, res) => {
  const ids = await visibleCourseIds(req.user);
  const { page, limit, skip } = parsePagination(req.query);
  if (req.query.courseId && ids && !ids.some((i) => i.equals(req.query.courseId))) return res.json({ data: [], total: 0, page, limit, pages: 0 });
  res.json(await feed(ids, { courseId: req.query.courseId, page, limit, skip }));
});

exports.reports = asyncHandler(async (req, res) => {
  const { user } = req;
  const { period, courseId, tzOffset } = req.query;
  if (user.role === 'student') {
    const ids = await visibleCourseIds(user);
    const buckets = await activityBuckets({ period, courseIds: courseId ? ids.filter((i) => i.equals(courseId)) : ids, studentId: user._id, tzOffset });
    return res.json({ period, buckets });
  }
  if (user.role !== 'admin' && user.role !== 'instructor') throw new ApiError(403, 'You do not have access to learning reports');
  const ids = await visibleCourseIds(user);
  if (courseId && ids && !ids.some((i) => i.equals(courseId))) throw new ApiError(403, 'You do not manage this course');
  const buckets = await activityBuckets({ period, courseIds: courseId ? [courseId] : ids, tzOffset });
  res.json({ period, buckets });
});

// Per-course enrollment, completion and average lesson progress.
async function courseStats(ids) {
  const courses = await Course.find(ids ? { _id: { $in: ids } } : {}, 'title status').lean();
  const cids = courses.map((c) => c._id);
  const [lessons, enrolls, done, finished] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: cids } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { course: { $in: cids }, status: { $in: ['active', 'completed'] } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    LessonProgress.aggregate([{ $match: { course: { $in: cids }, status: 'completed' } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { course: { $in: cids }, status: 'completed' } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
  ]);
  const m = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const [L, E, D, F] = [lessons, enrolls, done, finished].map(m);
  return courses.map((c) => {
    const enrolled = E[c._id] || 0;
    const possible = (L[c._id] || 0) * enrolled;
    return {
      courseId: c._id, title: c.title, status: c.status, lessonCount: L[c._id] || 0, enrolled, completed: F[c._id] || 0,
      completionRate: enrolled ? Math.round(((F[c._id] || 0) * 100) / enrolled) : 0,
      averageProgress: possible ? Math.min(100, Math.round(((D[c._id] || 0) * 100) / possible)) : 0,
    };
  });
}

async function staffDashboard(user, query) {
  const ids = await visibleCourseIds(user);
  const allowed = ids && new Set(ids.map(String));
  const since = query.since ? new Date(query.since) : new Date(Date.now() - 24 * 3600 * 1000);
  const courseFilter = ids ? { _id: { $in: ids } } : {};

  const [stats, totalCourses, totalLessons, totalStudents, recent, activity, sessions] = await Promise.all([
    courseStats(ids),
    Course.countDocuments(courseFilter),
    Lesson.countDocuments(ids ? { course: { $in: ids } } : {}),
    user.role === 'admin' ? User.countDocuments({ role: 'student' }) : Enrollment.distinct('student', { course: { $in: ids }, status: { $ne: 'dropped' } }).then((s) => s.length),
    feed(ids, { page: 1, limit: 8, skip: 0 }),
    activityBuckets({ period: 'daily', courseIds: ids, tzOffset: Number(query.tzOffset) || 0, count: 7 }),
    Attendance.find({ ...(ids ? { course: { $in: ids } } : {}), status: { $in: ['open', 'closed'] }, createdAt: { $gte: since } }).lean(),
  ]);

  let active = 0; let hidden = 0;
  presence.online().forEach((e) => {
    if (e.role !== 'student' || !e.courseIds.some((c) => !allowed || allowed.has(c))) return;
    if (e.share) active += 1; else hidden += 1;
  });

  const assignmentIds = (await Assignment.find(ids ? { course: { $in: ids } } : {}, '_id')).map((a) => a._id);
  const pendingAssignments = await Submission.countDocuments({ status: 'submitted', assignment: { $in: assignmentIds } });

  // Today's attendance: students who joined at least one session opened today, out of those enrolled when it opened.
  let expected = 0; let present = 0;
  for (const s of sessions) {
    const roster = await Enrollment.countDocuments({ course: s.course, status: { $in: ['active', 'completed'] }, createdAt: { $lte: s.openedAt || s.createdAt } });
    expected += roster;
    present += new Set(s.records.map((r) => r.student.toString())).size;
  }
  return {
    role: user.role, totalStudents, activeStudents: active, hiddenActiveCount: hidden, totalCourses, totalLessons, pendingAssignments,
    openSessions: sessions.filter((s) => s.status === 'open').length,
    todaysAttendance: { sessions: sessions.length, present, expected, percent: expected ? Math.round((present * 100) / expected) : null },
    courses: query.allCourses ? stats.sort((a, b) => b.enrolled - a.enrolled) : stats.sort((a, b) => b.enrolled - a.enrolled).slice(0, 10),
    overallCompletionRate: stats.reduce((n, c) => n + c.enrolled, 0) ? Math.round((stats.reduce((n, c) => n + c.completed, 0) * 100) / stats.reduce((n, c) => n + c.enrolled, 0)) : 0,
    recentActivity: recent.data, dailyActivity: activity,
  };
}

async function studentDashboard(rawStudentId, query) {
  const studentId = new mongoose.Types.ObjectId(rawStudentId); // aggregations need a real ObjectId, not the string from the URL
  const enrollments = await Enrollment.find({ student: studentId, status: { $in: ['active', 'completed'] } }, 'course status').lean();
  const ids = enrollments.map((e) => e.course);
  const published = await Course.find({ _id: { $in: ids }, status: 'published' }, '_id title').lean();
  const pubIds = published.map((c) => c._id);
  const [lessonCounts, myDone] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: pubIds } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    LessonProgress.aggregate([{ $match: { student: studentId, course: { $in: pubIds }, status: 'completed' } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
  ]);
  const total = Object.fromEntries(lessonCounts.map((r) => [r._id, r.n]));
  const done = Object.fromEntries(myDone.map((r) => [r._id, r.n]));
  // This student's own progress in each course (not the class average).
  const perCourse = published.map((c) => ({ courseId: c._id, title: c.title, percent: total[c._id] ? Math.min(100, Math.round(((done[c._id] || 0) * 100) / total[c._id])) : 0 }));
  const [assignments, mySubs, recentDone, activity] = await Promise.all([
    Assignment.find({ course: { $in: pubIds } }).populate('course', 'title').sort({ dueAt: 1 }).lean(),
    Submission.find({ student: studentId }, 'assignment').lean(),
    LessonProgress.find({ student: studentId, status: 'completed' }).sort({ completedAt: -1 }).limit(5).populate('lesson', 'title').populate('course', 'title').lean(),
    activityBuckets({ period: 'daily', courseIds: pubIds, studentId, tzOffset: Number(query.tzOffset) || 0, count: 7 }),
  ]);
  const submitted = new Set(mySubs.map((s) => s.assignment.toString()));
  const now = new Date();
  const todo = assignments.filter((a) => !submitted.has(a._id.toString()) && (a.dueAt > now || a.allowLate));
  const myCourses = await Enrollment.find({ student: studentId, status: { $in: ['active', 'completed'] }, course: { $in: pubIds } }, 'status').lean();

  // Attendance across the student's courses, using the same rules as the attendance report.
  let attended = 0; let counted = 0;
  const sessions = await Attendance.find({ course: { $in: pubIds }, status: 'closed' }).lean();
  const enrolledAt = new Map((await Enrollment.find({ student: studentId, course: { $in: pubIds } }, 'course createdAt').lean()).map((e) => [e.course.toString(), e.createdAt]));
  sessions.forEach((s) => {
    if ((s.openedAt || s.createdAt) < enrolledAt.get(s.course.toString())) return;
    counted += 1;
    if (s.records.some((r) => r.student.equals(studentId))) attended += 1;
  });
  return {
    role: 'student', enrolledCourses: published.length, completedCourses: myCourses.filter((e) => e.status === 'completed').length,
    averageProgress: perCourse.length ? Math.round(perCourse.reduce((n, c) => n + c.percent, 0) / perCourse.length) : 0,
    courses: perCourse,
    pendingAssignments: todo.slice(0, 5).map((a) => ({ _id: a._id, title: a.title, dueAt: a.dueAt, course: a.course })),
    pendingAssignmentCount: todo.length,
    attendance: { sessions: counted, attended, percent: counted ? Math.round((attended * 100) / counted) : null },
    recentCompletions: recentDone.map((r) => ({ lesson: r.lesson?.title, course: r.course?.title, completedAt: r.completedAt })),
    dailyActivity: activity,
  };
}

exports.dashboard = asyncHandler(async (req, res) => {
  const { user } = req;
  if (user.role === 'admin' || user.role === 'instructor') return res.json(await staffDashboard(user, req.query));
  if (user.role === 'student') return res.json(await studentDashboard(user._id, req.query));
  // parent
  const sid = req.query.studentId;
  if (!sid) throw new ApiError(400, 'studentId is required');
  if (!user.linkedStudents.some((id) => id.toString() === sid)) throw new ApiError(403, 'You can only view your linked students');
  res.json({ ...(await studentDashboard(sid, req.query)), role: 'parent' });
});
