const { Server } = require('socket.io');
const env = require('../config/env');
const { userFromToken } = require('../middleware/auth');
const presence = require('../services/presence');
const realtime = require('../services/realtime');
const attendance = require('../services/attendance');
const { logActivity } = require('../services/audit');
const { isManager, isEnrolled } = require('../services/courseAccess');
const { Course, Enrollment, Lesson, User } = require('../models');

const ID = /^[a-f0-9]{24}$/;
const MAX_EVENTS = 30; // per socket, per 10 seconds
const LESSON_LOG_GAP_MS = 5 * 60 * 1000;

async function enrolledCourseIds(userId) {
  const rows = await Enrollment.find({ student: userId, status: { $in: ['active', 'completed'] } }, 'course');
  const courses = await Course.find({ _id: { $in: rows.map((r) => r.course) }, status: 'published' }, '_id');
  return courses.map((c) => c.id);
}

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 10 * 1024, // events here are tiny; refuse anything large
  });
  realtime.setIo(io);

  // Every connection must present a valid, unrevoked token. Nothing else is trusted from the client.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.data.user = await userFromToken(token);
      next();
    } catch (err) {
      next(new Error(err.message || 'Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const { user } = socket.data;
    let gone = false;
    socket.once('disconnect', () => { gone = true; }); // client may drop while we await the DB below

    // Simple flood control: drop events beyond the allowance and tell the client.
    const bucket = { start: Date.now(), count: 0 };
    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - bucket.start > 10000) { bucket.start = now; bucket.count = 0; }
      if (++bucket.count > MAX_EVENTS) { socket.emit('rate:limited', { message: 'Too many events. Slow down.' }); return; }
      next();
    });

    // Rooms are decided here, from the database. Clients cannot ask for arbitrary rooms.
    socket.join(`user:${user.id}`);
    let courseIds = [];
    if (user.role === 'student') {
      courseIds = await enrolledCourseIds(user._id);
      courseIds.forEach((id) => socket.join(`course:${id}`));
    } else if (user.role === 'instructor') {
      (await Course.find({ instructors: user._id }, '_id')).forEach((c) => { socket.join(`course:${c.id}:staff`); socket.join(`course:${c.id}`); });
    } else if (user.role === 'admin') {
      socket.join('staff:all');
    }

    if (gone) return;
    const { entry, announce } = presence.connect(user, socket.id, courseIds);
    const sharing = () => presence.get(user.id)?.share !== false;
    const who = () => ({ studentId: user.id, studentName: user.name });

    if (user.role === 'student' && announce && entry.share) {
      courseIds.forEach((cid) => realtime.toStaff(cid, 'user:online', { ...who(), courseId: cid, onlineSince: entry.onlineSince }));
    }
    courseIds.forEach((cid) => realtime.dashboardUpdated(cid));
    socket.emit('ready', { userId: user.id, role: user.role, liveTracking: user.role === 'student', shareLiveActivity: entry.share });

    const handle = (ack, fn) => Promise.resolve().then(fn)
      .then((data) => typeof ack === 'function' && ack({ ok: true, ...data }))
      .catch((err) => typeof ack === 'function' && ack({ ok: false, message: err.message || 'Something went wrong' }));

    socket.on('course:join', (payload, ack) => handle(ack, async () => {
      const id = payload?.courseId;
      if (!ID.test(id || '')) throw new Error('A valid courseId is required');
      const course = await Course.findById(id);
      if (!course) throw new Error('Course not found');
      if (isManager(user, course)) {
        socket.join(`course:${id}:staff`); socket.join(`course:${id}`);
        return { role: 'staff' };
      }
      if (user.role === 'student' && course.status === 'published' && (await isEnrolled(user, course._id))) {
        socket.join(`course:${id}`);
        const e = presence.setLocation(user.id, { courseId: id, courseTitle: course.title });
        if (e && !e.courseIds.includes(id)) e.courseIds.push(id);
        if (sharing()) realtime.toStaff(id, 'course:joined', { ...who(), courseId: id, courseTitle: course.title, at: new Date().toISOString() });
        return { role: 'student' };
      }
      throw new Error('You are not allowed to join this course');
    }));

    socket.on('lesson:start', (payload, ack) => handle(ack, async () => {
      if (user.role !== 'student') throw new Error('Only students report lesson activity');
      if (!ID.test(payload?.lessonId || '')) throw new Error('A valid lessonId is required');
      const lesson = await Lesson.findById(payload.lessonId);
      const course = lesson && (await Course.findById(lesson.course));
      if (!course || course.status !== 'published' || !(await isEnrolled(user, course._id))) throw new Error('You are not enrolled in this course');

      socket.join(`course:${course.id}`);
      const e = presence.setLocation(user.id, { courseId: course.id, courseTitle: course.title, lessonId: lesson.id, lessonTitle: lesson.title });
      if (sharing()) {
        realtime.toStaff(course.id, 'lesson:started', { ...who(), courseId: course.id, courseTitle: course.title, lessonId: lesson.id, lessonTitle: lesson.title, at: new Date().toISOString() });
        const last = e.lastLessonLog;
        if (!last || last.lessonId !== lesson.id || Date.now() - last.at > LESSON_LOG_GAP_MS) {
          e.lastLessonLog = { lessonId: lesson.id, at: Date.now() };
          logActivity({ user: user.id, course: course.id, action: 'lesson.started', entityType: 'Lesson', entityId: lesson.id, meta: { lessonTitle: lesson.title } });
        }
      }
      realtime.dashboardUpdated(course.id);
      return {};
    }));

    socket.on('lesson:stop', (_payload, ack) => handle(ack, async () => {
      const e = presence.get(user.id);
      if (e && e.lessonId && sharing()) realtime.toStaff(e.courseId, 'lesson:stopped', { ...who(), courseId: e.courseId, lessonId: e.lessonId });
      presence.setLocation(user.id, { lessonId: null, lessonTitle: null });
      return {};
    }));

    socket.on('disconnect', () => {
      const disconnectedAt = new Date();
      presence.disconnect(user.id, socket.id, (gone) => {
        User.updateOne({ _id: user.id }, { lastSeenAt: gone.disconnectedAt }).catch(() => {});
        if (gone.role === 'student' && gone.share) {
          gone.courseIds.forEach((cid) => realtime.toStaff(cid, 'user:offline', { studentId: gone.id, studentName: gone.name, courseId: cid, lastSeenAt: gone.disconnectedAt }));
        }
        (gone.courseIds || []).forEach((cid) => realtime.dashboardUpdated(cid));
      });
      if (user.role === 'student') {
        // A student who vanishes from a live session is signed out of it, at the moment they left.
        const t = setTimeout(() => {
          if (!presence.isOnline(user.id)) attendance.leaveAllOpen(user, disconnectedAt).catch((err) => console.error('Auto-leave failed:', err.message));
        }, env.attendanceDisconnectGraceMs);
        t.unref?.();
      }
    });
  });

  return io;
}

module.exports = { initSockets };
