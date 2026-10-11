const { Attendance, Enrollment, User } = require('../models');
const ApiError = require('../utils/ApiError');
const realtime = require('./realtime');
const { notify } = require('./notify');
const { logActivity } = require('./audit');

const seconds = (from, to) => Math.max(0, Math.round((to - from) / 1000));

// A student joins an open session. Joining twice does not create a second open record.
async function joinSession(session, student) {
  if (session.status !== 'open') throw new ApiError(409, session.status === 'closed' ? 'This session has ended' : 'This session has not started yet');
  const open = session.records.find((r) => r.student.equals(student._id) && !r.leftAt);
  if (open) return { record: open, already: true };
  const joinedAt = new Date(); // the server's clock, never the client's
  const updated = await Attendance.findOneAndUpdate(
    { _id: session._id, status: 'open', records: { $not: { $elemMatch: { student: student._id, leftAt: { $exists: false } } } } },
    { $push: { records: { student: student._id, joinedAt } } },
    { new: true }
  );
  if (!updated) return { record: session.records.find((r) => r.student.equals(student._id) && !r.leftAt), already: true };
  realtime.toStaff(session.course, 'attendance:joined', { sessionId: session.id, courseId: String(session.course), studentId: student.id, studentName: student.name, at: joinedAt.toISOString() });
  realtime.dashboardUpdated(session.course);
  logActivity({ user: student.id, course: session.course, action: 'attendance.join', entityType: 'Attendance', entityId: session.id, meta: { title: session.title } });
  return { record: updated.records.find((r) => r.student.equals(student._id) && !r.leftAt), already: false };
}

// Ends a student's open segment. `at` lets the disconnect handler use the moment the student actually vanished.
async function leaveSession(sessionId, student, at = new Date()) {
  const session = await Attendance.findById(sessionId);
  const record = session?.records.find((r) => r.student.equals(student._id) && !r.leftAt);
  if (!record) return null;
  const leftAt = session.endsAt && session.endsAt < at ? session.endsAt : at;
  record.leftAt = leftAt;
  record.durationSec = seconds(record.joinedAt, leftAt);
  await session.save();
  realtime.toStaff(session.course, 'attendance:left', { sessionId: session.id, courseId: String(session.course), studentId: student.id, studentName: student.name, durationSec: record.durationSec, at: leftAt.toISOString() });
  realtime.dashboardUpdated(session.course);
  return record;
}

async function leaveAllOpen(student, at) {
  const sessions = await Attendance.find({ status: 'open', records: { $elemMatch: { student: student._id, leftAt: { $exists: false } } } }, '_id');
  for (const s of sessions) await leaveSession(s._id, student, at);
}

// Students who were enrolled when the session opened and have no record of joining.
async function absentees(session) {
  const cutoff = session.openedAt || session.createdAt;
  const enrolled = await Enrollment.find({ course: session.course, status: { $in: ['active', 'completed'] }, createdAt: { $lte: cutoff } }, 'student');
  const present = new Set(session.records.map((r) => r.student.toString()));
  return enrolled.map((e) => e.student).filter((id) => !present.has(id.toString()));
}

// Instructor ends the session: closes open segments, then alerts absent students and their linked parents.
async function closeSession(session, closer) {
  if (session.status !== 'open') throw new ApiError(409, 'Only an open session can be closed');
  const now = new Date();
  const end = session.endsAt && session.endsAt < now ? session.endsAt : now;
  session.records.forEach((r) => {
    if (!r.leftAt) { r.leftAt = end; r.durationSec = seconds(r.joinedAt, end); }
  });
  session.status = 'closed';
  session.closedAt = now;
  await session.save();

  const missing = await absentees(session);
  if (missing.length) {
    const link = '/attendance';
    await notify(missing, { title: `Missed session: ${session.title}`, body: 'You were not marked present in this session.', type: 'attendance', link, createdBy: closer._id });
    const parents = await User.find({ role: 'parent', status: 'active', linkedStudents: { $in: missing } }, 'name linkedStudents');
    const names = new Map((await User.find({ _id: { $in: missing } }, 'name')).map((u) => [u.id, u.name]));
    for (const p of parents) {
      const kids = p.linkedStudents.filter((id) => missing.some((m) => m.equals(id))).map((id) => names.get(id.toString()));
      await notify([p._id], { title: `Missed session: ${session.title}`, body: `${kids.join(', ')} was not marked present.`, type: 'attendance', link, createdBy: closer._id });
    }
  }
  realtime.toStaff(session.course, 'attendance:closed', { sessionId: session.id, courseId: String(session.course), absent: missing.length, present: session.records.length });
  realtime.toCourse(session.course, 'attendance:closed', { sessionId: session.id, courseId: String(session.course) });
  realtime.dashboardUpdated(session.course);
  return { absent: missing.length };
}

module.exports = { joinSession, leaveSession, leaveAllOpen, closeSession, absentees, seconds };
