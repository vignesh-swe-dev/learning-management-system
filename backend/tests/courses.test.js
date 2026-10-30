const { app, request, startDb, stopDb, clearDb, createUserWithToken } = require('./helpers');
const { Course, Module, Lesson, Enrollment } = require('../src/models');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const courseBody = { title: 'Intro to Testing', description: 'Learn to test web applications well.', category: 'Programming' };

async function setup() {
  return {
    admin: await createUserWithToken('admin'),
    teacher: await createUserWithToken('instructor', 'teacher@test.dev'),
    other: await createUserWithToken('instructor', 'other@test.dev'),
    student: await createUserWithToken('student', 'student@test.dev'),
  };
}

async function createCourse(token, body = courseBody) {
  const res = await request(app).post('/api/courses').set(bearer(token)).send(body);
  return res.body.course;
}
async function addLesson(token, courseId, lesson = { title: 'Welcome', type: 'text', content: 'Hello class' }) {
  const mod = await request(app).post(`/api/courses/${courseId}/modules`).set(bearer(token)).send({ title: 'Module 1' });
  const res = await request(app).post(`/api/modules/${mod.body.module._id}/lessons`).set(bearer(token)).send(lesson);
  return { module: mod.body.module, lesson: res.body.lesson, status: res.status };
}
async function publishedCourse(token, body) {
  const course = await createCourse(token, body);
  const added = await addLesson(token, course._id);
  await request(app).patch(`/api/courses/${course._id}`).set(bearer(token)).send({ status: 'published' });
  return { course, ...added };
}

describe('creating and editing courses', () => {
  it('lets instructors create draft courses assigned to themselves, and blocks students', async () => {
    const { teacher, student } = await setup();
    const res = await request(app).post('/api/courses').set(bearer(teacher.token)).send({ ...courseBody, status: 'published' });
    expect(res.status).toBe(201);
    expect(res.body.course.status).toBe('draft');
    expect(res.body.course.instructors).toEqual([teacher.user.id]);
    expect((await request(app).post('/api/courses').set(bearer(student.token)).send(courseBody)).status).toBe(403);
  });

  it('validates input', async () => {
    const { teacher } = await setup();
    const res = await request(app).post('/api/courses').set(bearer(teacher.token)).send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('lets only admins assign instructors, and only real instructors', async () => {
    const { admin, teacher, other, student } = await setup();
    const course = await createCourse(teacher.token);
    const asTeacher = await request(app).patch(`/api/courses/${course._id}`).set(bearer(teacher.token)).send({ instructors: [other.user.id] });
    expect(asTeacher.status).toBe(403);
    const bad = await request(app).patch(`/api/courses/${course._id}`).set(bearer(admin.token)).send({ instructors: [student.user.id] });
    expect(bad.status).toBe(400);
    const ok = await request(app).patch(`/api/courses/${course._id}`).set(bearer(admin.token)).send({ instructors: [teacher.user.id, other.user.id] });
    expect(ok.status).toBe(200);
    expect(ok.body.course.instructors).toHaveLength(2);
  });

  it('stops an instructor who is not assigned from editing', async () => {
    const { teacher, other } = await setup();
    const course = await createCourse(teacher.token);
    expect((await request(app).patch(`/api/courses/${course._id}`).set(bearer(other.token)).send({ title: 'Hijacked' })).status).toBe(403);
    const mod = await request(app).post(`/api/courses/${course._id}/modules`).set(bearer(other.token)).send({ title: 'Nope' });
    expect(mod.status).toBe(403);
  });

  it('requires a lesson before publishing', async () => {
    const { teacher } = await setup();
    const course = await createCourse(teacher.token);
    const early = await request(app).patch(`/api/courses/${course._id}`).set(bearer(teacher.token)).send({ status: 'published' });
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/lesson/i);
    await addLesson(teacher.token, course._id);
    const ok = await request(app).patch(`/api/courses/${course._id}`).set(bearer(teacher.token)).send({ status: 'published' });
    expect(ok.status).toBe(200);
    expect(ok.body.course.status).toBe('published');
  });
});

describe('lesson rules', () => {
  it('requires content for text lessons and a file or link for the others', async () => {
    const { teacher } = await setup();
    const course = await createCourse(teacher.token);
    expect((await addLesson(teacher.token, course._id, { title: 'Text lesson', type: 'text' })).status).toBe(400);
    expect((await addLesson(teacher.token, course._id, { title: 'Video lesson', type: 'video' })).status).toBe(400);
    expect((await addLesson(teacher.token, course._id, { title: 'Insecure link', type: 'video', resourceUrl: 'http://insecure.test/v.mp4' })).status).toBe(400);
    expect((await addLesson(teacher.token, course._id, { title: 'Secure link', type: 'video', resourceUrl: 'https://cdn.test/v.mp4' })).status).toBe(201);
  });

  it('numbers modules and lessons in order', async () => {
    const { teacher } = await setup();
    const course = await createCourse(teacher.token);
    const first = await addLesson(teacher.token, course._id);
    const second = await request(app).post(`/api/modules/${first.module._id}/lessons`).set(bearer(teacher.token))
      .send({ title: 'Second', type: 'text', content: 'More' });
    expect(first.lesson.order).toBe(0);
    expect(second.body.lesson.order).toBe(1);
  });
});

describe('visibility', () => {
  it('hides drafts from students and unassigned instructors', async () => {
    const { teacher, other, student, admin } = await setup();
    const draft = await createCourse(teacher.token);
    for (const who of [student, other]) {
      expect((await request(app).get(`/api/courses/${draft._id}`).set(bearer(who.token))).status).toBe(404);
      const list = await request(app).get('/api/courses').set(bearer(who.token));
      expect(list.body.total).toBe(0);
    }
    expect((await request(app).get(`/api/courses/${draft._id}`).set(bearer(teacher.token))).status).toBe(200);
    expect((await request(app).get('/api/courses').set(bearer(admin.token))).body.total).toBe(1);
  });

  it('filters, searches, sorts and paginates the catalogue', async () => {
    const { teacher, student } = await setup();
    await publishedCourse(teacher.token, { ...courseBody, title: 'Alpha Basics', category: 'Data', level: 'beginner' });
    await publishedCourse(teacher.token, { ...courseBody, title: 'Beta Advanced', category: 'Programming', level: 'advanced' });
    await publishedCourse(teacher.token, { ...courseBody, title: 'Gamma Tools', category: 'Programming', level: 'beginner' });
    const get = (qs) => request(app).get(`/api/courses?${qs}`).set(bearer(student.token));

    expect((await get('category=programming')).body.total).toBe(2);
    expect((await get('level=advanced')).body.data[0].title).toBe('Beta Advanced');
    expect((await get('q=gamma')).body.total).toBe(1);
    const sorted = await get('sort=title&limit=2&page=2');
    expect(sorted.body.data.map((c) => c.title)).toEqual(['Gamma Tools']);
    expect(sorted.body.pages).toBe(2);
    expect((await get('q=.*')).body.total).toBe(0); // regex characters are escaped
    expect((await get('')).body.categories).toEqual(['Data', 'Programming']);
  });
});

describe('enrollment and content access', () => {
  it('locks lesson content until the student enrolls', async () => {
    const { teacher, student } = await setup();
    const { course, lesson } = await publishedCourse(teacher.token);

    const before = await request(app).get(`/api/courses/${course._id}`).set(bearer(student.token));
    expect(before.body.access.canSeeContent).toBe(false);
    expect(before.body.modules[0].lessons[0].content).toBeUndefined();
    expect(before.body.modules[0].lessons[0].locked).toBe(true);
    expect((await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(student.token))).status).toBe(403);

    expect((await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id })).status).toBe(201);

    const after = await request(app).get(`/api/courses/${course._id}`).set(bearer(student.token));
    expect(after.body.modules[0].lessons[0].content).toBe('Hello class');
    const access = await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(student.token));
    expect(access.status).toBe(200);
    expect(access.body.lesson.content).toBe('Hello class');
  });

  it('rejects duplicate enrollment, drafts and non-students', async () => {
    const { teacher, student, admin } = await setup();
    const { course } = await publishedCourse(teacher.token);
    const draft = await createCourse(teacher.token, { ...courseBody, title: 'Draft course' });
    const enroll = (token, body) => request(app).post('/api/enrollments').set(bearer(token)).send(body);

    expect((await enroll(student.token, { courseId: course._id })).status).toBe(201);
    expect((await enroll(student.token, { courseId: course._id })).status).toBe(409);
    expect((await enroll(student.token, { courseId: draft._id })).status).toBe(404);
    expect((await enroll(teacher.token, { courseId: course._id })).status).toBe(403);
    expect((await enroll(student.token, { courseId: course._id, studentId: admin.user.id })).status).toBe(403);
  });

  it('lets an admin enroll a student, and shows students their courses', async () => {
    const { teacher, student, admin } = await setup();
    const { course } = await publishedCourse(teacher.token);
    const res = await request(app).post('/api/enrollments').set(bearer(admin.token)).send({ courseId: course._id, studentId: student.user.id });
    expect(res.status).toBe(201);
    const mine = await request(app).get('/api/enrollments/my-courses').set(bearer(student.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].course.title).toBe(courseBody.title);
    expect((await request(app).get('/api/enrollments/my-courses').set(bearer(teacher.token))).status).toBe(403);
  });

  it('removes access when a student drops, and restores it on re-enrolling', async () => {
    const { teacher, student } = await setup();
    const { course, lesson } = await publishedCourse(teacher.token);
    const enrolled = await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id });
    const drop = await request(app).patch(`/api/enrollments/${enrolled.body.enrollment._id}`).set(bearer(student.token)).send({ status: 'dropped' });
    expect(drop.status).toBe(200);
    expect((await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(student.token))).status).toBe(403);
    expect((await request(app).get('/api/enrollments/my-courses').set(bearer(student.token))).body.data).toHaveLength(0);
    expect((await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id })).status).toBe(201);
    expect(await Enrollment.countDocuments()).toBe(1);
  });

  it("stops one student changing another's enrollment", async () => {
    const { teacher, student } = await setup();
    const rival = await createUserWithToken('student', 'rival@test.dev');
    const { course } = await publishedCourse(teacher.token);
    const e = await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id });
    const res = await request(app).patch(`/api/enrollments/${e.body.enrollment._id}`).set(bearer(rival.token)).send({ status: 'dropped' });
    expect(res.status).toBe(403);
  });

  it('lists enrollments for course managers only', async () => {
    const { teacher, other, student } = await setup();
    const { course } = await publishedCourse(teacher.token);
    await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id });
    const ok = await request(app).get(`/api/courses/${course._id}/enrollments`).set(bearer(teacher.token));
    expect(ok.body.total).toBe(1);
    expect(ok.body.data[0].student.email).toBe('student@test.dev');
    expect((await request(app).get(`/api/courses/${course._id}/enrollments`).set(bearer(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/courses/${course._id}/enrollments`).set(bearer(student.token))).status).toBe(403);
  });
});

describe('deleting', () => {
  it('lets only admins delete and removes everything under the course', async () => {
    const { admin, teacher, student } = await setup();
    const { course } = await publishedCourse(teacher.token);
    await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id });

    expect((await request(app).delete(`/api/courses/${course._id}`).set(bearer(teacher.token))).status).toBe(403);
    expect((await request(app).delete(`/api/courses/${course._id}`).set(bearer(admin.token))).status).toBe(204);
    expect(await Course.countDocuments()).toBe(0);
    expect(await Module.countDocuments()).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);
    expect(await Enrollment.countDocuments()).toBe(0);
  });

  it('removes a module together with its lessons', async () => {
    const { teacher } = await setup();
    const course = await createCourse(teacher.token);
    const { module } = await addLesson(teacher.token, course._id);
    expect((await request(app).delete(`/api/modules/${module._id}`).set(bearer(teacher.token))).status).toBe(204);
    expect(await Lesson.countDocuments()).toBe(0);
  });
});
