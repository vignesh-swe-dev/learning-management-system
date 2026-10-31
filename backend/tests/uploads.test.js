const fs = require('fs');
const path = require('path');
const { app, request, startDb, stopDb, clearDb, createUserWithToken } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
// Smallest valid PNG and a minimal PDF header
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

const upload = (kind, token, buf, filename) =>
  request(app).post(`/api/uploads/${kind}`).set(bearer(token)).attach('file', buf, filename);

describe('thumbnails', () => {
  it('accepts a real image from an instructor and serves it publicly', async () => {
    const teacher = await createUserWithToken('instructor');
    const res = await upload('thumbnail', teacher.token, PNG, 'cover.png');
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/api\/thumbnails\/[a-f0-9]{32}\.png$/);
    const served = await request(app).get(res.body.url); // no auth header: used in <img> tags
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch('image/png');
  });

  it('can be attached to a course', async () => {
    const teacher = await createUserWithToken('instructor');
    const up = await upload('thumbnail', teacher.token, PNG, 'cover.png');
    const course = await request(app).post('/api/courses').set(bearer(teacher.token))
      .send({ title: 'With cover', description: 'A course with a cover image.', category: 'Art', thumbnail: up.body.url });
    expect(course.status).toBe(201);
    const bad = await request(app).post('/api/courses').set(bearer(teacher.token))
      .send({ title: 'Bad cover', description: 'A course with a bad cover.', category: 'Art', thumbnail: 'https://evil.test/x.png' });
    expect(bad.status).toBe(400);
  });

  it('rejects students, bad extensions, mismatched content and oversized files', async () => {
    const teacher = await createUserWithToken('instructor');
    const student = await createUserWithToken('student');
    expect((await upload('thumbnail', student.token, PNG, 'cover.png')).status).toBe(403);
    expect((await upload('thumbnail', teacher.token, PNG, 'cover.exe')).status).toBe(400);
    const fake = await upload('thumbnail', teacher.token, Buffer.from('<script>alert(1)</script>'), 'cover.png');
    expect(fake.status).toBe(400);
    expect(fake.body.message).toMatch(/does not match/);
    const big = await upload('thumbnail', teacher.token, Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]), 'big.png');
    expect(big.status).toBe(413);
    expect((await request(app).post('/api/uploads/thumbnail').set(bearer(teacher.token))).status).toBe(400);
  });

  it('does not leave rejected files on disk', async () => {
    const teacher = await createUserWithToken('instructor');
    const dir = path.join(process.env.UPLOAD_DIR, 'thumbnails');
    const before = fs.readdirSync(dir).length;
    await upload('thumbnail', teacher.token, Buffer.from('not an image'), 'x.png');
    expect(fs.readdirSync(dir).length).toBe(before);
  });
});

describe('lesson files', () => {
  async function lessonWithPdf() {
    const teacher = await createUserWithToken('instructor');
    const student = await createUserWithToken('student');
    const up = await upload('resource', teacher.token, PDF, 'notes.pdf');
    const course = (await request(app).post('/api/courses').set(bearer(teacher.token))
      .send({ title: 'PDF course', description: 'A course with a PDF lesson.', category: 'Docs' })).body.course;
    const mod = (await request(app).post(`/api/courses/${course._id}/modules`).set(bearer(teacher.token)).send({ title: 'M1' })).body.module;
    const lesson = (await request(app).post(`/api/modules/${mod._id}/lessons`).set(bearer(teacher.token))
      .send({ title: 'Notes', type: up.body.type, resourceUrl: up.body.url })).body.lesson;
    await request(app).patch(`/api/courses/${course._id}`).set(bearer(teacher.token)).send({ status: 'published' });
    return { teacher, student, up, course, lesson };
  }

  it('classifies uploads by type', async () => {
    const teacher = await createUserWithToken('instructor');
    const res = await upload('resource', teacher.token, PDF, 'notes.pdf');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'pdf', originalName: 'notes.pdf' });
    expect((await upload('resource', teacher.token, PDF, 'notes.sh')).status).toBe(400);
    expect((await upload('resource', teacher.token, Buffer.from('MZ binary'), 'a.pdf')).status).toBe(400);
  });

  it('serves a file only through a signed link issued to an enrolled student', async () => {
    const { student, up, course, lesson } = await lessonWithPdf();

    // Not enrolled: no link, and the raw URL is refused.
    expect((await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(student.token))).status).toBe(403);
    expect((await request(app).get(up.body.url)).status).toBe(403);

    await request(app).post('/api/enrollments').set(bearer(student.token)).send({ courseId: course._id });
    const access = await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(student.token));
    expect(access.status).toBe(200);
    expect(access.body.lesson.url).toContain('?token=');

    const file = await request(app).get(access.body.lesson.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch('application/pdf');

    // A token is tied to one file.
    const token = access.body.lesson.url.split('token=')[1];
    const otherName = `${'a'.repeat(32)}.pdf`;
    expect((await request(app).get(`/api/files/${otherName}?token=${token}`)).status).toBe(403);
    expect((await request(app).get(`${up.body.url}?token=garbage`)).status).toBe(403);
  });

  it('returns external links as they are', async () => {
    const teacher = await createUserWithToken('instructor');
    const course = (await request(app).post('/api/courses').set(bearer(teacher.token))
      .send({ title: 'Link course', description: 'A course with a video link.', category: 'Video' })).body.course;
    const mod = (await request(app).post(`/api/courses/${course._id}/modules`).set(bearer(teacher.token)).send({ title: 'M1' })).body.module;
    const lesson = (await request(app).post(`/api/modules/${mod._id}/lessons`).set(bearer(teacher.token))
      .send({ title: 'Watch', type: 'video', resourceUrl: 'https://cdn.test/v.mp4' })).body.lesson;
    const res = await request(app).get(`/api/lessons/${lesson._id}/access`).set(bearer(teacher.token));
    expect(res.body.lesson).toMatchObject({ url: 'https://cdn.test/v.mp4', external: true });
  });

  it('does not allow path traversal', async () => {
    const res = await request(app).get('/api/thumbnails/..%2F..%2Fpackage.json');
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/files/..%2F..%2F.env?token=x')).status).toBe(404);
  });
});
