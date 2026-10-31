const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll,
  startSockets, stopSockets, connect, waitFor, sleep } = require('./helpers');
const { Attendance, Notification, Enrollment } = require('../src/models');

let url;
beforeAll(async () => { await startDb(); url = await startSockets(); });
afterAll(async () => { await stopSockets(); await stopDb(); });
afterEach(async () => { await sleep(50); await clearDb(); });

async function world() {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const other = await createUserWithToken('instructor', 'o@test.dev');
  const a = await createUserWithToken('student', 'a@test.dev');
  const b = await createUserWithToken('student', 'b@test.dev');
  const outsider = await createUserWithToken('student', 'out@test.dev');
  const { course } = await publishedCourse(teacher.token);
  await enroll(a.token, course._id);
  await enroll(b.token, course._id);
  return { teacher, other, a, b, outsider, course };
}
const create = (token, body) => request(app).post('/api/attendance/sessions').set(bearer(token)).send(body);
const join = (token, id) => request(app).post(`/api/attendance/sessions/${id}/join`).set(bearer(token));
const leave = (token, id) => request(app).post(`/api/attendance/sessions/${id}/leave`).set(bearer(token));
const close = (token, id) => request(app).patch(`/api/attendance/sessions/${id}`).set(bearer(token)).send({ action: 'close' });

describe('sessions', () => {
  it('is controlled by the course’s instructors, and alerts enrolled students when it opens', async () => {
    const { teacher, other, a, outsider, course } = await world();
    expect((await create(a.token, { courseId: course._id, title: 'Sneaky' })).status).toBe(403);
    expect((await create(other.token, { courseId: course._id, title: 'Not mine' })).status).toBe(403);
    expect((await create(teacher.token, { courseId: course._id, title: 'x' })).status).toBe(400);

    const res = await create(teacher.token, { courseId: course._id, title: 'Week 1 live class' });
    expect(res.status).toBe(201);
    expect(res.body.session.status).toBe('open');
    const notes = await request(app).get('/api/notifications').set(bearer(a.token));
    expect(notes.body.data[0]).toMatchObject({ title: 'Session open: Week 1 live class', type: 'attendance' });
    expect((await request(app).get('/api/notifications').set(bearer(outsider.token))).body.total).toBe(0);
  });

  it('can be scheduled first and opened later, but only once', async () => {
    const { teacher, a, course } = await world();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Later class', open: false })).body.session;
    expect(s.status).toBe('scheduled');
    expect((await join(a.token, s._id)).status).toBe(409);
    const open = (t) => request(app).patch(`/api/attendance/sessions/${s._id}`).set(bearer(t)).send({ action: 'open' });
    expect((await open(teacher.token)).status).toBe(200);
    expect((await open(teacher.token)).status).toBe(409);
    expect((await join(a.token, s._id)).status).toBe(201);
  });
});

describe('joining and leaving', () => {
  it('records server-side timestamps and never accepts a duration from the client', async () => {
    const { teacher, a, course } = await world();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Timed class' })).body.session;
    const first = await join(a.token, s._id).send({ joinedAt: '2000-01-01T00:00:00Z' });
    expect(first.status).toBe(201);
    expect(new Date(first.body.joinedAt).getFullYear()).toBeGreaterThan(2020);
    const again = await join(a.token, s._id);
    expect(again.status).toBe(200);
    expect(again.body.alreadyJoined).toBe(true);
    expect((await Attendance.findById(s._id)).records).toHaveLength(1);

    const doc = await Attendance.findById(s._id);
    doc.records[0].joinedAt = new Date(Date.now() - 90000); // pretend they have been in for 90 s
    await doc.save();
    const out = await leave(a.token, s._id).send({ durationSec: 99999 });
    expect(out.status).toBe(200);
    expect(out.body.durationSec).toBeGreaterThanOrEqual(90);
    expect(out.body.durationSec).toBeLessThan(95);
    expect((await leave(a.token, s._id)).status).toBe(409);
  });

  it('allows rejoining and adds up the time', async () => {
    const { teacher, a, course } = await world();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Rejoin class' })).body.session;
    await join(a.token, s._id); await leave(a.token, s._id); await join(a.token, s._id);
    expect((await Attendance.findById(s._id)).records).toHaveLength(2);
  });

  it('only lets enrolled students in, and only while the session is open', async () => {
    const { teacher, outsider, a, course } = await world();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Closed soon' })).body.session;
    expect((await join(outsider.token, s._id)).status).toBe(403);
    expect((await join(teacher.token, s._id)).status).toBe(403);
    await close(teacher.token, s._id);
    expect((await join(a.token, s._id)).status).toBe(409);
  });

  it('tells instructors live when students join and leave', async () => {
    const { teacher, a, course } = await world();
    const staff = await connect(url, teacher.token);
    const s = (await create(teacher.token, { courseId: course._id, title: 'Live roster' })).body.session;
    const joined = waitFor(staff, 'attendance:joined');
    await join(a.token, s._id);
    expect(await joined).toMatchObject({ studentName: 'student user', sessionId: s._id });
    const left = waitFor(staff, 'attendance:left');
    await leave(a.token, s._id);
    expect((await left).durationSec).toBeGreaterThanOrEqual(0);
  });

  it('signs a student out of a live session if they disappear, at the time they left', async () => {
    const { teacher, a, course } = await world();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Dropped connection' })).body.session;
    const sock = await connect(url, a.token);
    await join(a.token, s._id);
    sock.close();
    await sleep(900); // presence grace + attendance grace
    const rec = (await Attendance.findById(s._id)).records[0];
    expect(rec.leftAt).toBeTruthy();
    expect(rec.durationSec).toBeLessThan(5);
  });
});

describe('closing a session', () => {
  it('closes open segments and alerts absent students and their parents', async () => {
    const { teacher, a, b, course } = await world();
    const parent = await createUserWithToken('parent', 'p@test.dev');
    parent.user.linkedStudents = [b.user.id];
    await parent.user.save();
    const s = (await create(teacher.token, { courseId: course._id, title: 'Attendance check' })).body.session;
    await join(a.token, s._id); // a is present and still "in"; b never shows up

    const res = await close(teacher.token, s._id);
    expect(res.status).toBe(200);
    expect(res.body.absent).toBe(1);
    const saved = await Attendance.findById(s._id);
    expect(saved.status).toBe('closed');
    expect(saved.records[0].leftAt).toBeTruthy();

    const missed = await Notification.find({ title: /Missed session/ });
    expect(missed.map((n) => n.user.toString()).sort()).toEqual([b.user.id, parent.user.id].sort());
    expect(missed.find((n) => n.user.toString() === parent.user.id).body).toMatch(/student user/);
    expect((await close(teacher.token, s._id)).status).toBe(409);

    const detail = await request(app).get(`/api/attendance/sessions/${s._id}`).set(bearer(teacher.token));
    expect(detail.body.roster).toHaveLength(1);
    expect(detail.body.absent.map((u) => u.email)).toEqual(['b@test.dev']);
    expect((await request(app).get(`/api/attendance/sessions/${s._id}`).set(bearer(a.token))).status).toBe(403);
  });

  it('does not count students who enrolled after a session opened', async () => {
    const { teacher, course } = await world();
    const late = await createUserWithToken('student', 'late@test.dev');
    const s = (await create(teacher.token, { courseId: course._id, title: 'Before late joined' })).body.session;
    await Enrollment.create({ student: late.user._id, course: course._id, createdAt: new Date(Date.now() + 60000) });
    const res = await close(teacher.token, s._id);
    expect(res.body.absent).toBe(2); // only the two students enrolled when it opened
  });
});

describe('listing and reports', () => {
  async function history() {
    const w = await world();
    const parent = await createUserWithToken('parent', 'p@test.dev');
    parent.user.linkedStudents = [w.a.user.id];
    await parent.user.save();
    const s1 = (await create(w.teacher.token, { courseId: w.course._id, title: 'Session one' })).body.session;
    await join(w.a.token, s1._id);
    await close(w.teacher.token, s1._id);
    const s2 = (await create(w.teacher.token, { courseId: w.course._id, title: 'Session two' })).body.session;
    await close(w.teacher.token, s2._id); // a skipped this one
    return { ...w, parent, s1, s2 };
  }

  it('shows students their own status in each session', async () => {
    const { a, teacher } = await history();
    const mine = await request(app).get('/api/attendance/sessions').set(bearer(a.token));
    expect(Object.fromEntries(mine.body.data.map((s) => [s.title, s.myStatus]))).toEqual({ 'Session one': 'present', 'Session two': 'absent' });
    expect(mine.body.data[0].records).toBeUndefined(); // never other students' records
    const staff = await request(app).get('/api/attendance/sessions').set(bearer(teacher.token));
    expect(staff.body.data.find((s) => s.title === 'Session one')).toMatchObject({ presentCount: 1, enrolledCount: 2 });
  });

  it('gives a student their attendance percentage and history', async () => {
    const { a } = await history();
    const res = await request(app).get('/api/attendance/reports').set(bearer(a.token));
    expect(res.body.courses[0]).toMatchObject({ sessionCount: 2, attended: 1, percent: 50 });
    expect(res.body.courses[0].history.map((h) => h.status).sort()).toEqual(['absent', 'present']);
  });

  it('gives instructors a per-student summary for their own courses only', async () => {
    const { teacher, other, student, course } = { ...(await history()), student: null };
    const res = await request(app).get('/api/attendance/reports').set(bearer(teacher.token));
    const row = res.body.courses[0];
    expect(row).toMatchObject({ sessionCount: 2, averagePercent: 25 });
    expect(row.students.map((s) => [s.student.email, s.percent]).sort()).toEqual([['a@test.dev', 50], ['b@test.dev', 0]]);
    expect((await request(app).get('/api/attendance/reports').set(bearer(other.token))).body.courses).toEqual([]);
    expect((await request(app).get(`/api/attendance/reports?courseId=${course._id}`).set(bearer(other.token))).status).toBe(403);
    expect(student).toBeNull();
  });

  it('lets a parent see a linked student’s attendance only', async () => {
    const { parent, a, b } = await history();
    const stranger = await createUserWithToken('parent', 'x@test.dev');
    const ok = await request(app).get(`/api/attendance/reports?studentId=${a.user.id}`).set(bearer(parent.token));
    expect(ok.body.courses[0].percent).toBe(50);
    expect((await request(app).get(`/api/attendance/reports?studentId=${b.user.id}`).set(bearer(parent.token))).status).toBe(403);
    expect((await request(app).get(`/api/attendance/reports?studentId=${a.user.id}`).set(bearer(stranger.token))).status).toBe(403);
    expect((await request(app).get('/api/attendance/reports').set(bearer(parent.token))).status).toBe(400);
    expect((await request(app).get('/api/attendance/sessions').set(bearer(parent.token))).status).toBe(403);
  });
});
