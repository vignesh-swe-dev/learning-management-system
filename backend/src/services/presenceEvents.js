const presence = require('./presence');
const realtime = require('./realtime');

// A student changed their "share live activity" setting: update what instructors see straight away.
function privacyChanged(user, share) {
  const entry = presence.setShare(user.id, share);
  if (!entry || !entry.sockets.size || entry.role !== 'student') return;
  const payload = { studentId: user.id, studentName: user.name, courseId: entry.courseId, lessonId: entry.lessonId, lessonTitle: entry.lessonTitle, courseTitle: entry.courseTitle, lastSeenAt: new Date().toISOString(), onlineSince: entry.onlineSince };
  entry.courseIds.forEach((cid) => realtime.toStaff(cid, share ? 'user:online' : 'user:offline', { ...payload, courseId: entry.courseId || cid }));
  entry.courseIds.forEach((cid) => realtime.dashboardUpdated(cid));
}
module.exports = { privacyChanged };
