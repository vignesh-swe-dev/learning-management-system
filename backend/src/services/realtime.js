const env = require('../config/env');

// Thin wrapper so controllers can publish live events without knowing whether Socket.IO is running
// (REST-only tests and scripts simply get no-ops).
let io = null;
const timers = new Map();
const lastProgressEmit = new Map();

const setIo = (instance) => { io = instance; };
const getIo = () => io;
const staffRooms = (courseId) => [`course:${courseId}:staff`, 'staff:all'];

function toStaff(courseId, event, payload) {
  if (!io || !courseId) return;
  io.to(staffRooms(courseId)).emit(event, payload);
}
function toUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}
function toCourse(courseId, event, payload) {
  if (io) io.to(`course:${courseId}`).emit(event, payload);
}

// Tells dashboards "something changed, refetch". Bursts are collapsed into one message.
function dashboardUpdated(courseId) {
  if (!io || !courseId) return;
  const key = String(courseId);
  if (timers.has(key)) return;
  const t = setTimeout(() => {
    timers.delete(key);
    toStaff(key, 'dashboard:updated', { courseId: key, at: new Date().toISOString() });
  }, env.dashboardDebounceMs);
  t.unref?.();
  timers.set(key, t);
}

// Server-originated lesson events. The numbers come from what the server stored, never from the client.
function lessonActivity({ student, lesson, status, watchedSec, percent, justCompleted }) {
  if (!io) return;
  const payload = {
    studentId: student.id, studentName: student.name, courseId: String(lesson.course), lessonId: lesson.id, lessonTitle: lesson.title,
    status, watchedSec, percent, at: new Date().toISOString(),
  };
  if (justCompleted) {
    toStaff(lesson.course, 'lesson:completed', payload); // a learning record, shown regardless of the live-status setting
    dashboardUpdated(lesson.course);
    return;
  }
  if (student.shareLiveActivity === false) return;
  const key = `${student.id}:${lesson.id}`;
  const now = Date.now();
  if (now - (lastProgressEmit.get(key) || 0) < 5000) return; // at most one progress message per student and lesson every 5 s
  lastProgressEmit.set(key, now);
  if (lastProgressEmit.size > 5000) lastProgressEmit.clear();
  toStaff(lesson.course, 'lesson:progress', payload);
}

// Keeps a connected student's rooms in step with enrollment changes, so no reconnect is needed.
const joinCourse = (userId, courseId) => { if (io) io.in(`user:${userId}`).socketsJoin(`course:${courseId}`); };
const leaveCourse = (userId, courseId) => { if (io) io.in(`user:${userId}`).socketsLeave(`course:${courseId}`); };
const disconnectUser = (userId) => { if (io) io.in(`user:${userId}`).disconnectSockets(true); };
const reset = () => { timers.forEach(clearTimeout); timers.clear(); lastProgressEmit.clear(); };

module.exports = { setIo, getIo, toStaff, toUser, toCourse, dashboardUpdated, lessonActivity, joinCourse, leaveCourse, disconnectUser, reset };
