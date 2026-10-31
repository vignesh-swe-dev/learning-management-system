const fs = require('fs');
const path = require('path');
const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll } = require('./helpers');
const { Assignment, Submission } = require('../src/models');

beforeAll(startDb);
beforeEach(() => {
  fs.rmSync(path.join(process.env.UPLOAD_DIR, 'submissions'), { recursive: true, force: true });
  fs.mkdirSync(path.join(process.env.UPLOAD_DIR, 'submissions'), { recursive: true });
});
afterAll(stopDb);
afterEach(clearDb);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const subDir = () => path.join(process.env.UPLOAD_DIR, 'submissions');
const fileCount = () => (fs.existsSync(subDir()) ? fs.readdirSync(subDir()).length : 0);
const future = () => new Date(Date.now() + 86400000).toISOString();

async function world() {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const student = await createUserWithToken('student', 's@test.dev');
  const { course } = await publishedCourse(teacher.token);
  await enroll(student.token, course._id);
  const a = await request(app).post('/api/assignments').set(bearer(teacher.token))
    .send({ courseId: course._id, title: 'Essay one', description: 'Write about testing.', dueAt: future(), maxMarks: 50, latePenaltyPercent: 20 });
  return { teacher, student, course, assignment: a.body.assignment };
}
const submit = (token, id) => request(app).post(`/api/assignments/${id}/submit`).set(bearer(token));

describe('creating assignments', () => {
  it('validates deadlines and marks, and checks who manages the course', async () => {
    const { teacher, student, course } = await world();
    const other = await createUserWithToken('instructor', 'o@test.dev');
    const base = { courseId: course._id, title: 'Task', description: 'Do the task.', dueAt: future(), maxMarks: 10 };
    const post = (t, b) => request(app).post('/api/assignments').set(bearer(t)).send(b);
    expect((await post(teacher.token, { ...base, dueAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(400);
    expect((await post(teacher.token, { ...base, maxMarks: 0 })).status).toBe(400);
    expect((await post(teacher.token, { ...base, latePenaltyPercent: 150 })).status).toBe(400);
    expect((await post(student.token, base)).status).toBe(403);
    expect((await post(other.token, base)).status).toBe(403);
    expect((await post(teacher.token, base)).status).toBe(201);
  });

  it('shows students only assignments for courses they are enrolled in, with their status', async () => {
    const { teacher, student } = await world();
    const { course: unrelated } = await publishedCourse(teacher.token);
    await request(app).post('/api/assignments').set(bearer(teacher.token))
      .send({ courseId: unrelated._id, title: 'Hidden', description: 'Not yours.', dueAt: future(), maxMarks: 5 });
    const list = await request(app).get('/api/assignments').set(bearer(student.token));
    expect(list.body.data.map((a) => a.title)).toEqual(['Essay one']);
    expect(list.body.data[0].state).toBe('pending');
    const mine = await request(app).get('/api/assignments').set(bearer(teacher.token));
    expect(mine.body.total).toBe(2);
    expect(mine.body.data[0].submissionCount).toBe(0);
  });
});

describe('submitting', () => {
  it('accepts text, a file, or both, and rejects an empty submission', async () => {
    const { student, assignment } = await world();
    expect((await submit(student.token, assignment._id).send({})).status).toBe(400);
    const text = await submit(student.token, assignment._id).send({ answerText: 'My essay.' });
    expect(text.status).toBe(201);
    expect(text.body.submission.isLate).toBe(false);
    const withFile = await submit(student.token, assignment._id).field('answerText', 'Updated').attach('file', PDF, 'essay.pdf');
    expect(withFile.status).toBe(200);
    expect(withFile.body.submission.files[0]).toMatchObject({ originalName: 'essay.pdf', mimeType: 'application/pdf' });
    expect(await Submission.countDocuments()).toBe(1);
    expect(fileCount()).toBe(1);
  });

  it('replaces the old file on resubmission and keeps it when only the text changes', async () => {
    const { student, assignment } = await world();
    await submit(student.token, assignment._id).attach('file', PDF, 'v1.pdf');
    await submit(student.token, assignment._id).attach('file', Buffer.concat([PDF, Buffer.from('v2')]), 'v2.pdf');
    expect(fileCount()).toBe(1);
    const keep = await submit(student.token, assignment._id).send({ answerText: 'Only text changed' });
    expect(keep.body.submission.files[0].originalName).toBe('v2.pdf');
    expect(fileCount()).toBe(1);
  });

  it('rejects bad files without leaving anything on disk', async () => {
    const { student, assignment } = await world();
    const before = fileCount();
    expect((await submit(student.token, assignment._id).attach('file', Buffer.from('echo hi'), 'run.sh')).status).toBe(400);
    expect((await submit(student.token, assignment._id).attach('file', Buffer.from('not a pdf'), 'fake.pdf')).status).toBe(400);
    expect(fileCount()).toBe(before);
  });

  it('only accepts submissions from enrolled students', async () => {
    const { teacher, assignment } = await world();
    const outsider = await createUserWithToken('student', 'out@test.dev');
    const before = fileCount();
    expect((await submit(outsider.token, assignment._id).attach('file', PDF, 'a.pdf')).status).toBe(403);
    expect((await submit(teacher.token, assignment._id).send({ answerText: 'x' })).status).toBe(403);
    expect(fileCount()).toBe(before); // rejected before the upload was stored
  });

  it('enforces the deadline and the late-submission rule', async () => {
    const { student, assignment } = await world();
    await Assignment.updateOne({ _id: assignment._id }, { dueAt: new Date(Date.now() - 3600000), allowLate: false });
    const closed = await submit(student.token, assignment._id).send({ answerText: 'Too late' });
    expect(closed.status).toBe(403);
    expect(closed.body.message).toMatch(/deadline/i);

    await Assignment.updateOne({ _id: assignment._id }, { allowLate: true });
    const late = await submit(student.token, assignment._id).send({ answerText: 'Late but accepted' });
    expect(late.status).toBe(201);
    expect(late.body.submission.isLate).toBe(true);
    expect((await submit(student.token, assignment._id).send({ answerText: 'Change after deadline' })).status).toBe(403);
  });
});

describe('grading and files', () => {
  it('grades with a late penalty, stops over-marking and locks the submission', async () => {
    const { teacher, student, assignment } = await world();
    const other = await createUserWithToken('instructor', 'o@test.dev');
    await Assignment.updateOne({ _id: assignment._id }, { dueAt: new Date(Date.now() - 3600000), allowLate: true });
    const sub = (await submit(student.token, assignment._id).send({ answerText: 'Late work' })).body.submission;
    const grade = (t, b) => request(app).patch(`/api/submissions/${sub._id}/grade`).set(bearer(t)).send(b);

    expect((await grade(student.token, { marks: 50 })).status).toBe(403);
    expect((await grade(other.token, { marks: 40 })).status).toBe(403);
    expect((await grade(teacher.token, { marks: 51 })).status).toBe(400);
    const ok = await grade(teacher.token, { marks: 40, feedback: 'Good effort' });
    expect(ok.body.submission).toMatchObject({ marks: 40, finalMarks: 32, status: 'graded', feedback: 'Good effort' }); // 20% late penalty
    expect((await submit(student.token, assignment._id).send({ answerText: 'again' })).status).toBe(409); // already graded
  });

  it('shows the grade in the student’s list', async () => {
    const { teacher, student, assignment } = await world();
    const sub = (await submit(student.token, assignment._id).send({ answerText: 'On time' })).body.submission;
    await request(app).patch(`/api/submissions/${sub._id}/grade`).set(bearer(teacher.token)).send({ marks: 45 });
    const list = await request(app).get('/api/assignments').set(bearer(student.token));
    expect(list.body.data[0]).toMatchObject({ state: 'graded', submission: { marks: 45 } });
    const subs = await request(app).get(`/api/assignments/${assignment._id}/submissions`).set(bearer(teacher.token));
    expect(subs.body.data[0].student.email).toBe('s@test.dev');
    expect((await request(app).get(`/api/assignments/${assignment._id}/submissions`).set(bearer(student.token))).status).toBe(403);
  });

  it('serves a submitted file to its owner and the course instructor only', async () => {
    const { teacher, student, assignment } = await world();
    const rival = await createUserWithToken('student', 'r@test.dev');
    const other = await createUserWithToken('instructor', 'o@test.dev');
    const sub = (await submit(student.token, assignment._id).attach('file', PDF, 'essay.pdf')).body.submission;
    const get = (t) => request(app).get(`/api/submissions/${sub._id}/file`).set(bearer(t));
    const own = await get(student.token);
    expect(own.status).toBe(200);
    expect(own.headers['content-disposition']).toMatch(/essay\.pdf/);
    expect((await get(teacher.token)).status).toBe(200);
    expect((await get(rival.token)).status).toBe(403);
    expect((await get(other.token)).status).toBe(403);
    expect((await request(app).get(`/api/submissions/${sub._id}/file`)).status).toBe(401);
  });

  it('removes submissions and their files when an assignment is deleted', async () => {
    const { teacher, student, assignment } = await world();
    await submit(student.token, assignment._id).attach('file', PDF, 'essay.pdf');
    expect(fileCount()).toBeGreaterThan(0);
    const before = fileCount();
    expect((await request(app).delete(`/api/assignments/${assignment._id}`).set(bearer(teacher.token))).status).toBe(204);
    expect(await Submission.countDocuments()).toBe(0);
    expect(fileCount()).toBe(before - 1);
  });
});
