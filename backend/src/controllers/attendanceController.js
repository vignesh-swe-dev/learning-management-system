const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Attendance, Enrollment, User } = require('../models');
const { parsePagination } = require('../utils/pagination');
const realtime = require('../services/realtime');
const { notifyCourseStudents } = require('../services/notify');
const att = require('../services/attendance');
const { requireManager, requireStudentAccess, visibleCourseIds, loadCourse, isManager } = require('../services/courseAccess');

async function openSideEffects(session) {
  realtime.toCourse(session.course, 'attendance:opened', { sessionId: session.id, courseId: String(session.course), title: session.title });
  realtime.dashboardUpdated(session.course);
  await notifyCourseStudents(session.course, { title: `Session open: ${session.title}`, body: 'Join now to be marked present.', type: 'attendance', link: '/attendance', createdBy: session.instructor });
}

exports.createSession = asyncHandler(async (req, res) => {
  const { courseId, open, ...rest } = req.body;
  await requireManager(req.user, courseId);
  const session = await Attendance.create({
    ...rest, course: courseId, instructor: req.user._id,
    status: open ? 'open' : 'scheduled', openedAt: open ? new Date() : undefined,
  });
  if (open) await openSideEffects(session);
  res.status(201).json({ session });
});

exports.updateSession = asyncHandler(async (req, res) => {
  const session = await Attendance.findById(req.params.id);
  if (!session) throw new ApiError(404, 'Session not found');
  await requireManager(req.user, session.course);
  if (req.body.action === 'open') {
    if (session.status !== 'scheduled') throw new ApiError(409, 'Only a scheduled session can be opened');
    session.status = 'open';
    session.openedAt = new Date();
    await session.save();
    await openSideEffects(session);
    return res.json({ session });
  }
  const result = await att.closeSession(session, req.user);
  res.json({ session, ...result });
});

exports.list = asyncHandler(async (req, res) => {
  const { user } = req;
  const { page, limit, skip } = parsePagination(req.query);
  const ids = await visibleCourseIds(user);
  const filter = {};
  if (ids) filter.course = { $in: ids };
  if (req.query.courseId) {
    if (ids && !ids.some((id) => id.equals(req.query.courseId))) return res.json({ data: [], page, limit, total: 0, pages: 0 });
    filter.course = req.query.courseId;
  }
  if (user.role === 'student') filter.status = req.query.status ? req.query.status : { $in: ['open', 'closed'] };
  else if (req.query.status) filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    Attendance.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('course', 'title').lean(),
    Attendance.countDocuments(filter),
  ]);

  let data;
  if (user.role === 'student') {
    const enrolled = new Map((await Enrollment.find({ student: user._id, course: { $in: rows.map((r) => r.course._id) } }, 'course createdAt')).map((e) => [e.course.toString(), e.createdAt]));
    data = rows.map(({ records, ...s }) => {
      const mine = records.filter((r) => r.student.equals(user._id));
      const joined = mine.some((r) => !r.leftAt);
      const minutes = Math.round(mine.reduce((n, r) => n + (r.leftAt ? r.durationSec : att.seconds(r.joinedAt, new Date())), 0) / 60);
      const counted = (s.openedAt || s.createdAt) >= (enrolled.get(s.course._id.toString()) || 0);
      const myStatus = joined ? 'joined' : mine.length ? 'present' : s.status === 'open' ? 'not_joined' : counted ? 'absent' : 'not_enrolled';
      return { ...s, myStatus, myMinutes: minutes };
    });
  } else {
    const courseIds = rows.map((r) => r.course._id);
    const counts = await Enrollment.aggregate([{ $match: { course: { $in: courseIds }, status: { $in: ['active', 'completed'] } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]);
    const byCourse = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    data = rows.map(({ records, ...s }) => ({
      ...s, enrolledCount: byCourse[s.course._id] || 0,
      presentCount: new Set(records.map((r) => r.student.toString())).size,
      joinedNow: records.filter((r) => !r.leftAt).length,
    }));
  }
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
});

exports.getSession = asyncHandler(async (req, res) => {
  const session = await Attendance.findById(req.params.id).populate('records.student', 'name email').populate('course', 'title');
  if (!session) throw new ApiError(404, 'Session not found');
  await requireManager(req.user, session.course._id);
  const roster = session.records.map((r) => ({ student: r.student, joinedAt: r.joinedAt, leftAt: r.leftAt || null, durationSec: r.leftAt ? r.durationSec : att.seconds(r.joinedAt, new Date()), inSession: !r.leftAt }));
  let absent = [];
  if (session.status === 'closed') {
    const raw = await Attendance.findById(session.id);
    absent = await User.find({ _id: { $in: await att.absentees(raw) } }, 'name email');
  }
  res.json({ session: { _id: session._id, title: session.title, status: session.status, course: session.course, openedAt: session.openedAt, closedAt: session.closedAt }, roster, absent });
});

exports.join = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students join sessions');
  const session = await Attendance.findById(req.params.id);
  if (!session) throw new ApiError(404, 'Session not found');
  await requireStudentAccess(req.user, session.course);
  const { record, already } = await att.joinSession(session, req.user);
  res.status(already ? 200 : 201).json({ joinedAt: record.joinedAt, alreadyJoined: already });
});

exports.leave = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students leave sessions');
  const record = await att.leaveSession(req.params.id, req.user);
  if (!record) throw new ApiError(409, 'You are not currently in this session');
  res.json({ leftAt: record.leftAt, durationSec: record.durationSec });
});

// ---- reports ----
async function studentReport(studentId, courseFilter, range) {
  const enrollments = await Enrollment.find({ student: studentId, status: { $ne: 'dropped' }, ...(courseFilter ? { course: { $in: courseFilter } } : {}) }).populate('course', 'title');
  const now = new Date();
  const courses = [];
  for (const e of enrollments) {
    if (!e.course) continue;
    const sessions = await Attendance.find({ course: e.course._id, status: { $in: ['open', 'closed'] }, ...range }).sort({ createdAt: -1 }).lean();
    const counted = sessions.filter((s) => (s.openedAt || s.createdAt) >= e.createdAt);
    const history = counted.map((s) => {
      const mine = s.records.filter((r) => r.student.toString() === String(studentId));
      return { sessionId: s._id, title: s.title, date: s.openedAt || s.createdAt, status: mine.length ? 'present' : s.status === 'open' ? 'open' : 'absent',
        minutes: Math.round(mine.reduce((n, r) => n + (r.leftAt ? r.durationSec : att.seconds(r.joinedAt, now)), 0) / 60) };
    });
    const closedOrJoined = history.filter((h) => h.status !== 'open');
    const attended = history.filter((h) => h.status === 'present').length;
    courses.push({
      course: e.course, sessionCount: closedOrJoined.length, attended,
      percent: closedOrJoined.length ? Math.round((attended * 100) / closedOrJoined.length) : null,
      totalMinutes: history.reduce((n, h) => n + h.minutes, 0), history: history.slice(0, 30),
    });
  }
  return { courses };
}

async function staffReport(courseIds, range) {
  const Course = require('../models/Course');
  const courses = await Course.find(courseIds ? { _id: { $in: courseIds } } : {}, 'title').lean();
  const out = [];
  for (const course of courses) {
    const [sessions, enrollments] = await Promise.all([
      Attendance.find({ course: course._id, status: { $in: ['open', 'closed'] }, ...range }).lean(),
      Enrollment.find({ course: course._id, status: { $in: ['active', 'completed'] } }).populate('student', 'name email').limit(300),
    ]);
    const now = new Date();
    const students = enrollments.filter((e) => e.student).map((e) => {
      const counted = sessions.filter((s) => (s.openedAt || s.createdAt) >= e.createdAt && s.status === 'closed');
      const mineAll = sessions.flatMap((s) => s.records.filter((r) => r.student.equals(e.student._id)).map((r) => ({ r, sid: s._id.toString() })));
      const attended = counted.filter((s) => s.records.some((r) => r.student.equals(e.student._id))).length;
      return {
        student: e.student, attended, sessions: counted.length,
        percent: counted.length ? Math.round((attended * 100) / counted.length) : null,
        totalMinutes: Math.round(mineAll.reduce((n, { r }) => n + (r.leftAt ? r.durationSec : att.seconds(r.joinedAt, now)), 0) / 60),
      };
    });
    const withPercent = students.filter((s) => s.percent !== null);
    out.push({
      course: { _id: course._id, title: course.title }, sessionCount: sessions.length,
      averagePercent: withPercent.length ? Math.round(withPercent.reduce((n, s) => n + s.percent, 0) / withPercent.length) : null,
      students,
    });
  }
  return { courses: out };
}

exports.reports = asyncHandler(async (req, res) => {
  const { user } = req;
  const range = {};
  if (req.query.from || req.query.to) {
    range.createdAt = {};
    if (req.query.from) range.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) range.createdAt.$lte = new Date(req.query.to);
  }
  if (user.role === 'student') return res.json(await studentReport(user._id, req.query.courseId ? [req.query.courseId] : null, range));

  if (user.role === 'parent') {
    const sid = req.query.studentId;
    if (!sid) throw new ApiError(400, 'studentId is required');
    if (!user.linkedStudents.some((id) => id.toString() === sid)) throw new ApiError(403, 'You can only view attendance for your linked students');
    return res.json(await studentReport(sid, req.query.courseId ? [req.query.courseId] : null, range));
  }
  // admin and instructors
  const ids = await visibleCourseIds(user);
  let scope = ids;
  if (req.query.courseId) {
    const course = await loadCourse(req.query.courseId);
    if (!isManager(user, course)) throw new ApiError(403, 'You do not manage this course');
    scope = [course._id];
  }
  if (req.query.studentId) return res.json(await studentReport(req.query.studentId, scope, range));
  res.json(await staffReport(scope, range));
});
