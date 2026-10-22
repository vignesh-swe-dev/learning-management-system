const mongoose = require('mongoose');
const { LessonProgress, Submission, QuizAttempt, Attendance, Assignment, Quiz } = require('../models');

const COUNTS = { daily: 14, weekly: 12, monthly: 12 };
const UNIT = { daily: 'day', weekly: 'week', monthly: 'month' };

const offsetString = (m) => `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;

// First instant of the day, week (Monday) or month containing `date`, in the viewer's time zone (offset in minutes east of UTC).
function bucketStart(date, period, offsetMin) {
  const d = new Date(date.getTime() + offsetMin * 60000);
  d.setUTCHours(0, 0, 0, 0);
  if (period === 'weekly') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (period === 'monthly') d.setUTCDate(1);
  return new Date(d.getTime() - offsetMin * 60000);
}
function previous(start, period, offsetMin) {
  const d = new Date(start.getTime() + offsetMin * 60000);
  if (period === 'daily') d.setUTCDate(d.getUTCDate() - 1);
  else if (period === 'weekly') d.setUTCDate(d.getUTCDate() - 7);
  else d.setUTCMonth(d.getUTCMonth() - 1);
  return new Date(d.getTime() - offsetMin * 60000);
}

// Learning activity per day, week or month, built from stored records (lesson completions, submissions,
// quiz attempts and attendance joins), so it never depends on heartbeats and survives restarts.
// Aggregation pipelines do not convert string ids the way queries do, so ids arriving from query strings are cast here.
const oid = (v) => (v == null || v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v));

async function activityBuckets({ period = 'daily', courseIds: rawCourseIds = null, studentId: rawStudentId = null, tzOffset = 0, count }) {
  const courseIds = rawCourseIds && rawCourseIds.map(oid);
  const studentId = oid(rawStudentId);
  const n = count || COUNTS[period];
  const starts = [];
  let cur = bucketStart(new Date(), period, tzOffset);
  for (let i = 0; i < n; i += 1) { starts.unshift(cur); cur = previous(cur, period, tzOffset); }
  const from = starts[0];
  const trunc = (field) => ({ $dateTrunc: { date: field, unit: UNIT[period], timezone: offsetString(tzOffset), startOfWeek: 'monday' } });
  const byStudent = studentId ? { student: studentId } : {};
  const courseMatch = courseIds ? { course: { $in: courseIds } } : {};

  const [assignmentIds, quizIds] = courseIds
    ? await Promise.all([Assignment.find(courseMatch, '_id'), Quiz.find(courseMatch, '_id')])
    : [null, null];
  const group = (field) => ({ $group: { _id: trunc(field), n: { $sum: 1 }, students: { $addToSet: '$student' } } });

  const [lessons, subs, quizzes, joins] = await Promise.all([
    LessonProgress.aggregate([{ $match: { status: 'completed', completedAt: { $gte: from }, ...courseMatch, ...byStudent } }, group('$completedAt')]),
    Submission.aggregate([{ $match: { submittedAt: { $gte: from }, ...(assignmentIds ? { assignment: { $in: assignmentIds.map((a) => a._id) } } : {}), ...byStudent } }, group('$submittedAt')]),
    QuizAttempt.aggregate([{ $match: { status: { $ne: 'in_progress' }, submittedAt: { $gte: from }, ...(quizIds ? { quiz: { $in: quizIds.map((q) => q._id) } } : {}), ...byStudent } }, group('$submittedAt')]),
    Attendance.aggregate([
      { $match: courseMatch }, { $unwind: '$records' },
      { $match: { 'records.joinedAt': { $gte: from }, ...(studentId ? { 'records.student': studentId } : {}) } },
      { $group: { _id: trunc('$records.joinedAt'), n: { $sum: 1 }, students: { $addToSet: '$records.student' } } },
    ]),
  ]);

  const index = (rows) => new Map(rows.map((r) => [new Date(r._id).getTime(), r]));
  const [L, S, Q, J] = [lessons, subs, quizzes, joins].map(index);
  return starts.map((start) => {
    const k = start.getTime();
    const people = new Set([L, S, Q, J].flatMap((m) => (m.get(k)?.students || []).map(String)));
    return {
      start, lessonsCompleted: L.get(k)?.n || 0, submissions: S.get(k)?.n || 0, quizAttempts: Q.get(k)?.n || 0,
      attendanceJoins: J.get(k)?.n || 0, activeStudents: people.size,
    };
  });
}

module.exports = { activityBuckets, bucketStart };
