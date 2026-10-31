const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll, PASSWORD,
  startSockets, stopSockets, connect, waitFor, sleep } = require('./helpers');
const { Notification } = require('../src/models');

let url;
beforeAll(async () => { await startDb(); url = await startSockets(); });
afterAll(async () => { await stopSockets(); await stopDb(); });
afterEach(async () => { await sleep(50); await clearDb(); });

async function world() {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const other = await createUserWithToken('instructor', 'o@test.dev');
  const student = await createUserWithToken('student', 's@test.dev');
  const outsider = await createUserWithToken('student', 'out@test.dev');
  const { course } = await publishedCourse(teacher.token);
  await enroll(student.token, course._id);
  return { teacher, other, student, outsider, course };
}
const announce = (token, body) => request(app).post('/api/notifications/announcements').set(bearer(token)).send(body);

describe('announcements', () => {
  it('goes to the students of a course the instructor teaches, and is pushed live', async () => {
    const { teacher, other, student, outsider, course } = await world();
    const sock = await connect(url, student.token);
    const pushed = waitFor(sock, 'notification:new');
    const res = await announce(teacher.token, { courseId: course._id, title: 'Exam on Friday', body: 'Revise modules 1 and 2.' });
    expect(res.body.sent).toBe(1);
    expect(await pushed).toMatchObject({ title: 'Exam on Friday', type: 'announcement' });
    expect((await request(app).get('/api/notifications').set(bearer(outsider.token))).body.total).toBe(0);
    expect((await announce(other.token, { courseId: course._id, title: 'Hijack', body: 'No.' })).status).toBe(403);
    expect((await announce(student.token, { courseId: course._id, title: 'Student post', body: 'No.' })).status).toBe(403);
    expect((await announce(teacher.token, { title: 'To everyone', body: 'Not allowed.' })).status).toBe(400);
  });

  it('lets an admin announce to everyone', async () => {
    const { student, teacher } = await world();
    const admin = await createUserWithToken('admin');
    const res = await announce(admin.token, { title: 'Maintenance tonight', body: 'The site will be offline briefly.' });
    expect(res.body.sent).toBe(await Notification.countDocuments());
    expect((await request(app).get('/api/notifications').set(bearer(student.token))).body.total).toBe(1);
    expect((await request(app).get('/api/notifications').set(bearer(teacher.token))).body.total).toBe(1);
  });
});

describe('reading notifications', () => {
  it('counts unread, marks one or all as read, and keeps them private', async () => {
    const { teacher, student, outsider, course } = await world();
    await announce(teacher.token, { courseId: course._id, title: 'First notice', body: 'One.' });
    await announce(teacher.token, { courseId: course._id, title: 'Second notice', body: 'Two.' });
    const list = await request(app).get('/api/notifications').set(bearer(student.token));
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.data[0].title).toBe('Second notice');

    const read = await request(app).patch(`/api/notifications/${list.body.data[0]._id}/read`).set(bearer(student.token));
    expect(read.body.notification.readAt).toBeTruthy();
    expect((await request(app).get('/api/notifications?unread=true').set(bearer(student.token))).body.total).toBe(1);
    expect((await request(app).patch(`/api/notifications/${list.body.data[1]._id}/read`).set(bearer(outsider.token))).status).toBe(404);
    expect((await request(app).post('/api/notifications/read-all').set(bearer(student.token))).body.updated).toBe(1);
    expect((await request(app).get('/api/notifications').set(bearer(student.token))).body.unreadCount).toBe(0);
  });

  it('notifies students about new assignments and grades', async () => {
    const { teacher, student, course } = await world();
    const a = (await request(app).post('/api/assignments').set(bearer(teacher.token))
      .send({ courseId: course._id, title: 'Essay', description: 'Write it.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10 })).body.assignment;
    const sub = (await request(app).post(`/api/assignments/${a._id}/submit`).set(bearer(student.token)).send({ answerText: 'Done' })).body.submission;
    await request(app).patch(`/api/submissions/${sub._id}/grade`).set(bearer(teacher.token)).send({ marks: 8 });
    const titles = (await request(app).get('/api/notifications').set(bearer(student.token))).body.data.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['New assignment: Essay', 'Graded: Essay']));
  });
});

describe('changing the password', () => {
  it('checks the current password, signs out other sessions and keeps this one', async () => {
    const { student } = await world();
    const sock = await connect(url, student.token);
    const change = (b) => request(app).post('/api/auth/change-password').set(bearer(student.token)).send(b);
    expect((await change({ currentPassword: 'Wrong1234', newPassword: 'Another1234' })).status).toBe(400);
    expect((await change({ currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
    expect((await change({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);

    const closed = waitFor(sock, 'disconnect');
    const ok = await change({ currentPassword: PASSWORD, newPassword: 'Another1234' });
    expect(ok.status).toBe(200);
    await closed;
    expect((await request(app).get('/api/auth/me').set(bearer(student.token))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer(ok.body.token))).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 's@test.dev', password: 'Another1234' })).status).toBe(200);
  });
});
