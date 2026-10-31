const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll } = require('./helpers');
const { LessonProgress, Enrollment, Certificate } = require('../src/models');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const report = (token, lessonId, body = {}) => request(app).post(`/api/progress/lessons/${lessonId}`).set(bearer(token)).send(body);

async function world(lessons) {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const student = await createUserWithToken('student', 's@test.dev');
  const { course, lessons: ls } = await publishedCourse(teacher.token, { lessons });
  await enroll(student.token, course._id);
  return { teacher, student, course, lessons: ls };
}
const TWO_TEXT = [{ title: 'One', type: 'text', content: 'a' }, { title: 'Two', type: 'text', content: 'b' }];

describe('recording progress', () => {
  it('tracks completion, enrollment status and issues a certificate at 100%', async () => {
    const { student, course, lessons } = await world(TWO_TEXT);
    const first = await report(student.token, lessons[0]._id, { completed: true });
    expect(first.status).toBe(200);
    expect(first.body.course).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect((await Enrollment.findOne()).status).toBe('active');
    expect(await Certificate.countDocuments()).toBe(0);

    const second = await report(student.token, lessons[1]._id, { completed: true });
    expect(second.body.course.percent).toBe(100);
    const enrollment = await Enrollment.findOne();
    expect(enrollment.status).toBe('completed');
    expect(enrollment.completedAt).toBeTruthy();

    const cert = await Certificate.findOne();
    expect(cert.verificationId).toMatch(/^[A-F0-9]{16}$/);
    const verify = await request(app).get(`/api/certificates/verify/${cert.verificationId.toLowerCase()}`); // public, case-insensitive
    expect(verify.body).toMatchObject({ valid: true, course: 'Test course' });
    expect((await request(app).get('/api/certificates/verify/NOPE')).status).toBe(404);
    const mine = await request(app).get('/api/certificates/my').set(bearer(student.token));
    expect(mine.body.data).toHaveLength(1);

    // Reporting completion again changes nothing and does not duplicate the certificate.
    await report(student.token, lessons[1]._id, { completed: true });
    expect(await Certificate.countDocuments()).toBe(1);
    expect(course._id).toBeTruthy();
  });

  it('reopens the enrollment when a lesson is added after completion', async () => {
    const { teacher, student, lessons } = await world([TWO_TEXT[0]]);
    await report(student.token, lessons[0]._id, { completed: true });
    expect((await Enrollment.findOne()).status).toBe('completed');
    const mod = lessons[0].module;
    await request(app).post(`/api/modules/${mod}/lessons`).set(bearer(teacher.token)).send({ title: 'New', type: 'text', content: 'more' });
    await report(student.token, lessons[0]._id, {}); // any later report refreshes the status
    expect((await Enrollment.findOne()).status).toBe('active');
  });

  it('only lets enrolled students record progress', async () => {
    const { teacher, lessons } = await world(TWO_TEXT);
    const outsider = await createUserWithToken('student', 'out@test.dev');
    expect((await report(outsider.token, lessons[0]._id, { completed: true })).status).toBe(403);
    expect((await report(teacher.token, lessons[0]._id, { completed: true })).status).toBe(403);
    expect((await request(app).post(`/api/progress/lessons/${lessons[0]._id}`).send({})).status).toBe(401);
  });
});

describe('server-side validation of watch progress', () => {
  const VIDEO = [{ title: 'Clip', type: 'video', resourceUrl: 'https://cdn.test/clip.mp4', durationSec: 100 }];

  it('does not trust a client claiming it watched far more than the clock allows', async () => {
    const { student, lessons } = await world(VIDEO);
    await report(student.token, lessons[0]._id, {}); // opening the lesson starts the clock
    const res = await report(student.token, lessons[0]._id, { watchedSec: 100 });
    expect(res.body.lesson.watchedSec).toBeLessThan(10);
    const done = await report(student.token, lessons[0]._id, { watchedSec: 100, completed: true });
    expect(done.status).toBe(400);
    expect(done.body.message).toMatch(/90%/);
  });

  it('never lets watch time go down, and caps it at the video length', async () => {
    const { student, lessons } = await world(VIDEO);
    await report(student.token, lessons[0]._id, {});
    await LessonProgress.updateOne({}, { watchedSec: 80, lastReportedAt: new Date(Date.now() - 600000) });
    expect((await report(student.token, lessons[0]._id, { watchedSec: 10 })).body.lesson.watchedSec).toBe(80);
    expect((await report(student.token, lessons[0]._id, { watchedSec: 5000 })).body.lesson.watchedSec).toBeLessThanOrEqual(100);
  });

  it('allows completion once enough has genuinely been watched', async () => {
    const { student, lessons } = await world(VIDEO);
    await report(student.token, lessons[0]._id, {});
    await LessonProgress.updateOne({}, { watchedSec: 95 });
    const done = await report(student.token, lessons[0]._id, { completed: true });
    expect(done.status).toBe(200);
    expect(done.body.lesson.status).toBe('completed');
  });

  it('rejects malformed reports', async () => {
    const { student, lessons } = await world(TWO_TEXT);
    expect((await report(student.token, lessons[0]._id, { watchedSec: -5 })).status).toBe(400);
    expect((await report(student.token, lessons[0]._id, { watchedSec: 'lots' })).status).toBe(400);
  });
});

describe('reading progress', () => {
  it('shows a student their own progress and lets managers and linked parents see it', async () => {
    const { teacher, student, course, lessons } = await world(TWO_TEXT);
    const other = await createUserWithToken('instructor', 'other@test.dev');
    const parent = await createUserWithToken('parent');
    const stranger = await createUserWithToken('parent', 'stranger@test.dev');
    parent.user.linkedStudents = [student.user.id];
    await parent.user.save();
    await report(student.token, lessons[0]._id, { completed: true });

    const own = await request(app).get(`/api/progress/${course._id}`).set(bearer(student.token));
    expect(own.body).toMatchObject({ total: 2, completed: 1, percent: 50 });
    expect(own.body.lessons.map((l) => l.status).sort()).toEqual(['completed', 'not_started']);
    expect(own.body.lastLessonId).toBe(lessons[0]._id);

    const q = `?studentId=${student.user.id}`;
    expect((await request(app).get(`/api/progress/${course._id}${q}`).set(bearer(teacher.token))).body.percent).toBe(50);
    expect((await request(app).get(`/api/progress/${course._id}${q}`).set(bearer(parent.token))).status).toBe(200);
    expect((await request(app).get(`/api/progress/${course._id}${q}`).set(bearer(stranger.token))).status).toBe(403);
    expect((await request(app).get(`/api/progress/${course._id}${q}`).set(bearer(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/progress/${course._id}`).set(bearer(teacher.token))).status).toBe(400);
  });

  it('gives instructors per-student completion for their course only', async () => {
    const { teacher, student, course, lessons } = await world(TWO_TEXT);
    const other = await createUserWithToken('instructor', 'other@test.dev');
    await report(student.token, lessons[0]._id, { completed: true });
    const res = await request(app).get(`/api/instructor/courses/${course._id}/progress`).set(bearer(teacher.token));
    expect(res.body.data[0]).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect(res.body.data[0].student.email).toBe('s@test.dev');
    expect(res.body.data[0].lastActivityAt).toBeTruthy();
    expect((await request(app).get(`/api/instructor/courses/${course._id}/progress`).set(bearer(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/instructor/courses/${course._id}/progress`).set(bearer(student.token))).status).toBe(403);
  });

  it('adds progress to my-courses', async () => {
    const { student, lessons } = await world(TWO_TEXT);
    await report(student.token, lessons[0]._id, { completed: true });
    const res = await request(app).get('/api/enrollments/my-courses').set(bearer(student.token));
    expect(res.body.data[0].progress).toEqual({ total: 2, completed: 1, percent: 50 });
  });
});
