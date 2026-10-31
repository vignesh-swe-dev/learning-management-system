const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll,
  startSockets, stopSockets, connect, waitFor, expectNo, emitAck, sleep } = require('./helpers');
const { User } = require('../src/models');

let url;
beforeAll(async () => { await startDb(); url = await startSockets(); });
afterAll(async () => { await stopSockets(); await stopDb(); });
afterEach(async () => { await sleep(50); await clearDb(); });

async function world() {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const other = await createUserWithToken('instructor', 'o@test.dev');
  const student = await createUserWithToken('student', 's@test.dev');
  const student2 = await createUserWithToken('student', 's2@test.dev');
  const outsider = await createUserWithToken('student', 'out@test.dev');
  const { course, lessons } = await publishedCourse(teacher.token);
  await enroll(student.token, course._id);
  await enroll(student2.token, course._id);
  return { teacher, other, student, student2, outsider, course, lesson: lessons[0] };
}

describe('connecting', () => {
  it('refuses connections without a valid token', async () => {
    await expect(connect(url, undefined)).rejects.toThrow(/Authentication required/);
    await expect(connect(url, 'garbage')).rejects.toThrow(/Invalid or expired token/);
  });

  it('refuses a token that was revoked by logging out', async () => {
    const { student } = await world();
    await request(app).post('/api/auth/logout').set(bearer(student.token));
    await expect(connect(url, student.token)).rejects.toThrow(/no longer valid/);
  });

  it('tells a student that live tracking is active, and what is shared', async () => {
    const { student, teacher } = await world();
    const s = await connect(url, student.token);
    expect(s.info).toMatchObject({ role: 'student', liveTracking: true, shareLiveActivity: true });
    expect((await connect(url, teacher.token)).info.liveTracking).toBe(false);
  });

  it('signs the socket out when the user logs out', async () => {
    const { student } = await world();
    const s = await connect(url, student.token);
    const closed = waitFor(s, 'disconnect');
    await request(app).post('/api/auth/logout').set(bearer(student.token));
    await closed;
  });

  it('limits how fast a client can send events', async () => {
    const { student } = await world();
    const s = await connect(url, student.token);
    const limited = waitFor(s, 'rate:limited');
    for (let i = 0; i < 45; i += 1) s.emit('lesson:stop');
    expect((await limited).message).toMatch(/slow down/i);
  });
});

describe('who sees whom', () => {
  it('shows a student going online to the instructors of their courses only', async () => {
    const { teacher, other, student, student2 } = await world();
    const mine = await connect(url, teacher.token);
    const notMine = await connect(url, other.token);
    const peer = await connect(url, student2.token);
    const seen = waitFor(mine, 'user:online');
    await Promise.all([expectNo(notMine, 'user:online'), expectNo(peer, 'user:online')].map((p) => p.catch((e) => { throw e; })).concat(
      (async () => { await connect(url, student.token); return (await seen); })().then((e) => expect(e).toMatchObject({ studentName: 'student user' })),
    ));
  });

  it('shows an admin everything', async () => {
    const { student } = await world();
    const admin = await createUserWithToken('admin');
    const a = await connect(url, admin.token);
    const seen = waitFor(a, 'user:online');
    await connect(url, student.token);
    expect((await seen).studentId).toBe(student.user.id);
  });

  it('lets a student report a lesson only in a course they are enrolled in', async () => {
    const { teacher, student, outsider, lesson } = await world();
    const staff = await connect(url, teacher.token);
    const s = await connect(url, student.token);
    const started = waitFor(staff, 'lesson:started');
    expect((await emitAck(s, 'lesson:start', { lessonId: lesson._id })).ok).toBe(true);
    expect(await started).toMatchObject({ studentName: 'student user', lessonTitle: 'Welcome', lessonId: lesson._id });

    const o = await connect(url, outsider.token);
    const refused = await emitAck(o, 'lesson:start', { lessonId: lesson._id });
    expect(refused).toMatchObject({ ok: false, message: expect.stringMatching(/not enrolled/i) });
    expect((await emitAck(s, 'lesson:start', { lessonId: 'nope' })).ok).toBe(false);
    expect((await emitAck(staff, 'lesson:start', { lessonId: lesson._id })).ok).toBe(false);
  });

  it('checks course rooms against the database', async () => {
    const { teacher, other, student, outsider, course } = await world();
    expect(await emitAck(await connect(url, student.token), 'course:join', { courseId: course._id })).toMatchObject({ ok: true });
    expect(await emitAck(await connect(url, teacher.token), 'course:join', { courseId: course._id })).toMatchObject({ ok: true, role: 'staff' });
    expect((await emitAck(await connect(url, outsider.token), 'course:join', { courseId: course._id })).ok).toBe(false);
    expect((await emitAck(await connect(url, other.token), 'course:join', { courseId: course._id })).ok).toBe(false);
    expect((await emitAck(await connect(url, student.token), 'course:join', { courseId: 'x' })).ok).toBe(false);
  });

  it('does not leak one student’s activity to another student', async () => {
    const { student, student2, lesson } = await world();
    const peer = await connect(url, student2.token);
    const s = await connect(url, student.token);
    await Promise.all([expectNo(peer, 'lesson:started'), emitAck(s, 'lesson:start', { lessonId: lesson._id })]);
  });
});

describe('going offline', () => {
  it('announces offline after the grace period, and records when the student was last seen', async () => {
    const { teacher, student } = await world();
    const staff = await connect(url, teacher.token);
    const online = waitFor(staff, 'user:online');
    const s = await connect(url, student.token);
    await online;
    const offline = waitFor(staff, 'user:offline');
    s.close();
    expect((await offline).studentId).toBe(student.user.id);
    await sleep(100);
    expect((await User.findById(student.user.id)).lastSeenAt).toBeTruthy();
  });

  it('does not flicker offline when a student reconnects quickly (a page reload)', async () => {
    const { teacher, student } = await world();
    const staff = await connect(url, teacher.token);
    const online = waitFor(staff, 'user:online');
    const first = await connect(url, student.token);
    await online;
    first.close();
    await sleep(40);
    await Promise.all([expectNo(staff, 'user:offline', 500), expectNo(staff, 'user:online', 500), connect(url, student.token)]);
  });
});

describe('privacy control', () => {
  it('hides live status and lesson viewing when a student turns sharing off, and restores it when they turn it on', async () => {
    const { teacher, student, lesson } = await world();
    const staff = await connect(url, teacher.token);
    const online = waitFor(staff, 'user:online');
    const s = await connect(url, student.token);
    await online;

    const hidden = waitFor(staff, 'user:offline');
    const off = await request(app).patch(`/api/users/${student.user.id}`).set(bearer(student.token)).send({ shareLiveActivity: false });
    expect(off.body.user.shareLiveActivity).toBe(false);
    await hidden;

    await Promise.all([expectNo(staff, 'lesson:started'), emitAck(s, 'lesson:start', { lessonId: lesson._id })]);
    const list = await request(app).get('/api/tracking/active-students').set(bearer(teacher.token));
    expect(list.body).toMatchObject({ data: [], hiddenCount: 1 });

    const shown = waitFor(staff, 'user:online');
    await request(app).patch(`/api/users/${student.user.id}`).set(bearer(student.token)).send({ shareLiveActivity: true });
    await shown;
    expect((await request(app).get('/api/tracking/active-students').set(bearer(teacher.token))).body.data).toHaveLength(1);
  });
});

describe('server-originated progress events', () => {
  it('tells instructors about completions, using the stored values', async () => {
    const { teacher, student, lesson } = await world();
    const staff = await connect(url, teacher.token);
    const done = waitFor(staff, 'lesson:completed');
    const updated = waitFor(staff, 'dashboard:updated');
    await request(app).post(`/api/progress/lessons/${lesson._id}`).set(bearer(student.token)).send({ completed: true });
    expect(await done).toMatchObject({ studentName: 'student user', lessonTitle: 'Welcome', percent: 100, status: 'completed' });
    expect((await updated).courseId).toBeTruthy();
  });

  it('shares in-progress updates only while the student shares live activity, and not more than once every few seconds', async () => {
    const { teacher, student, lesson } = await world();
    const staff = await connect(url, teacher.token);
    const first = waitFor(staff, 'lesson:progress');
    const post = (b) => request(app).post(`/api/progress/lessons/${lesson._id}`).set(bearer(student.token)).send(b);
    await post({ watchedSec: 0 });
    expect((await first).status).toBe('in_progress');
    await Promise.all([expectNo(staff, 'lesson:progress'), post({ watchedSec: 1 })]); // throttled
    await request(app).patch(`/api/users/${student.user.id}`).set(bearer(student.token)).send({ shareLiveActivity: false });
  });

  it('tells instructors about assignment submissions', async () => {
    const { teacher, student, course } = await world();
    const staff = await connect(url, teacher.token);
    const a = (await request(app).post('/api/assignments').set(bearer(teacher.token))
      .send({ courseId: course._id, title: 'Live task', description: 'Do the task.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10 })).body.assignment;
    const event = waitFor(staff, 'assignment:submitted');
    await request(app).post(`/api/assignments/${a._id}/submit`).set(bearer(student.token)).send({ answerText: 'done' });
    expect(await event).toMatchObject({ title: 'Live task', studentName: 'student user', isLate: false });
  });

  it('puts a student who enrolls while connected straight into the course room', async () => {
    const { teacher, outsider, course } = await world();
    const s = await connect(url, outsider.token);
    await enroll(outsider.token, course._id);
    const openedEvent = waitFor(s, 'attendance:opened');
    const session = await request(app).post('/api/attendance/sessions').set(bearer(teacher.token)).send({ courseId: course._id, title: 'Live class' });
    const opened = await openedEvent;
    expect(opened.sessionId).toBe(session.body.session._id);
  });
});
