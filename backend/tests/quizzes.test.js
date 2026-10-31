const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll } = require('./helpers');
const { QuizAttempt, Assignment } = require('../src/models');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const mcq = (text, marks = 2) => ({ text, type: 'mcq', marks, options: [{ text: 'Right', isCorrect: true }, { text: 'Wrong' }, { text: 'Also wrong' }] });
const essay = { text: 'Explain why tests matter.', type: 'descriptive', marks: 10 };

async function world(quizBody = {}) {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const student = await createUserWithToken('student', 's@test.dev');
  const { course } = await publishedCourse(teacher.token);
  await enroll(student.token, course._id);
  const res = await request(app).post('/api/quizzes').set(bearer(teacher.token))
    .send({ courseId: course._id, title: 'Quiz one', maxAttempts: 2, questions: [mcq('Question one'), mcq('Question two')], ...quizBody });
  return { teacher, student, course, quiz: res.body.quiz, status: res.status, body: res.body };
}
const start = (token, id) => request(app).post(`/api/quizzes/${id}/attempts`).set(bearer(token));
const submit = (token, quizId, attemptId, answers) =>
  request(app).post(`/api/quizzes/${quizId}/attempts/${attemptId}/submit`).set(bearer(token)).send({ answers });
const correct = (q) => ({ question: q._id, selectedOption: q.options.find((o) => o.isCorrect)._id });
const wrong = (q) => ({ question: q._id, selectedOption: q.options.find((o) => !o.isCorrect)._id });

describe('creating quizzes', () => {
  it('validates the questions', async () => {
    const { teacher, course } = await world();
    const post = (questions) => request(app).post('/api/quizzes').set(bearer(teacher.token)).send({ courseId: course._id, title: 'Bad quiz', questions });
    const twoCorrect = { ...mcq('Question'), options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }] };
    const noneCorrect = { ...mcq('Question'), options: [{ text: 'A' }, { text: 'B' }] };
    const oneOption = { ...mcq('Question'), options: [{ text: 'A', isCorrect: true }] };
    const two = await post([twoCorrect]);
    expect(two.status).toBe(400);
    expect(JSON.stringify(two.body.details)).toMatch(/exactly one correct option/);
    expect((await post([noneCorrect])).status).toBe(400);
    expect((await post([oneOption])).status).toBe(400);
    expect((await post([])).status).toBe(400);
    expect((await post([essay, mcq('Question')])).status).toBe(201);
  });

  it('is limited to managers of the course', async () => {
    const { student, course } = await world();
    const other = await createUserWithToken('instructor', 'o@test.dev');
    const body = { courseId: course._id, title: 'Sneaky', questions: [mcq('Question')] };
    expect((await request(app).post('/api/quizzes').set(bearer(student.token)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/quizzes').set(bearer(other.token)).send(body)).status).toBe(403);
  });
});

describe('taking a quiz', () => {
  it('hides the questions and answers until an attempt is started', async () => {
    const { teacher, student, quiz } = await world();
    const view = await request(app).get(`/api/quizzes/${quiz._id}`).set(bearer(student.token));
    expect(view.body.quiz.questions).toBeUndefined();
    expect(view.body.quiz).toMatchObject({ questionCount: 2, totalMarks: 4, maxAttempts: 2 });
    const manager = await request(app).get(`/api/quizzes/${quiz._id}`).set(bearer(teacher.token));
    expect(manager.body.quiz.questions[0].options.some((o) => o.isCorrect)).toBe(true);

    const attempt = await start(student.token, quiz._id);
    expect(attempt.status).toBe(201);
    expect(JSON.stringify(attempt.body.questions)).not.toMatch(/isCorrect/);
    expect(attempt.body.questions).toHaveLength(2);
  });

  it('scores multiple-choice answers on the server', async () => {
    const { teacher, student, quiz } = await world();
    const full = (await request(app).get(`/api/quizzes/${quiz._id}`).set(bearer(teacher.token))).body.quiz.questions;
    const attempt = await start(student.token, quiz._id);
    const res = await submit(student.token, quiz._id, attempt.body.attempt.id, [correct(full[0]), wrong(full[1])]);
    expect(res.status).toBe(200);
    expect(res.body.attempt).toMatchObject({ score: 2, maxScore: 4, percent: 50, status: 'graded', pendingReview: false });
    expect(res.body.attempt.results.map((r) => r.correct)).toEqual([true, false]);
    expect((await submit(student.token, quiz._id, attempt.body.attempt.id, [])).status).toBe(409);
  });

  it('rejects answers that do not belong to the quiz', async () => {
    const { teacher, student, quiz } = await world();
    const full = (await request(app).get(`/api/quizzes/${quiz._id}`).set(bearer(teacher.token))).body.quiz.questions;
    const attempt = await start(student.token, quiz._id);
    const id = attempt.body.attempt.id;
    expect((await submit(student.token, quiz._id, id, [{ question: '64b64b64b64b64b64b64b64b', selectedOption: full[0].options[0]._id }])).status).toBe(400);
    expect((await submit(student.token, quiz._id, id, [{ question: full[0]._id, selectedOption: full[1].options[0]._id }])).status).toBe(400);
    expect((await submit(student.token, quiz._id, id, [correct(full[0]), correct(full[0])])).status).toBe(400);
  });

  it('enforces the attempt limit and resumes an unfinished attempt', async () => {
    const { student, quiz } = await world();
    const a1 = await start(student.token, quiz._id);
    const again = await start(student.token, quiz._id);
    expect(again.body.resumed).toBe(true);
    expect(again.body.attempt.id).toBe(a1.body.attempt.id);
    await submit(student.token, quiz._id, a1.body.attempt.id, []);
    const a2 = await start(student.token, quiz._id);
    expect(a2.body.attempt.attemptNumber).toBe(2);
    await submit(student.token, quiz._id, a2.body.attempt.id, []);
    const third = await start(student.token, quiz._id);
    expect(third.status).toBe(403);
    expect(third.body.message).toMatch(/all 2 attempts/);
  });

  it('only lets enrolled students in', async () => {
    const { teacher, quiz } = await world();
    const outsider = await createUserWithToken('student', 'out@test.dev');
    expect((await start(outsider.token, quiz._id)).status).toBe(403);
    expect((await start(teacher.token, quiz._id)).status).toBe(403);
    expect((await request(app).get(`/api/quizzes/${quiz._id}`).set(bearer(outsider.token))).status).toBe(403);
  });
});

describe('timed quizzes', () => {
  it('closes an attempt submitted after the time limit', async () => {
    const { student, quiz } = await world({ timeLimitMin: 1 });
    const attempt = await start(student.token, quiz._id);
    expect(attempt.body.attempt.expiresAt).toBeTruthy();
    await QuizAttempt.updateOne({ _id: attempt.body.attempt.id }, { startedAt: new Date(Date.now() - 5 * 60000) });
    const late = await submit(student.token, quiz._id, attempt.body.attempt.id, []);
    expect(late.status).toBe(400);
    expect(late.body.message).toMatch(/time limit/i);
    const saved = await QuizAttempt.findById(attempt.body.attempt.id);
    expect(saved.status).toBe('graded');
    expect(saved.score).toBe(0);
  });

  it('counts an attempt left to expire and starts a fresh one', async () => {
    const { student, quiz } = await world({ timeLimitMin: 1, maxAttempts: 3 });
    const first = await start(student.token, quiz._id);
    await QuizAttempt.updateOne({ _id: first.body.attempt.id }, { startedAt: new Date(Date.now() - 5 * 60000) });
    const next = await start(student.token, quiz._id);
    expect(next.status).toBe(201);
    expect(next.body.attempt.attemptNumber).toBe(2);
    expect((await QuizAttempt.findById(first.body.attempt.id)).status).toBe('graded');
  });
});

describe('descriptive answers', () => {
  async function pending() {
    const w = await world({ questions: [mcq('Question one'), essay] });
    const full = (await request(app).get(`/api/quizzes/${w.quiz._id}`).set(bearer(w.teacher.token))).body.quiz.questions;
    const attempt = await start(w.student.token, w.quiz._id);
    const res = await submit(w.student.token, w.quiz._id, attempt.body.attempt.id, [correct(full[0]), { question: full[1]._id, text: 'They catch bugs early.' }]);
    return { ...w, full, attemptId: attempt.body.attempt.id, res };
  }

  it('waits for manual grading, then updates the score', async () => {
    const { teacher, student, full, attemptId, res } = await pending();
    expect(res.body.attempt).toMatchObject({ status: 'submitted', pendingReview: true, score: 2, maxScore: 12 });

    const detail = await request(app).get(`/api/quiz-attempts/${attemptId}`).set(bearer(teacher.token));
    expect(detail.body.attempt.answers[1].answerText).toBe('They catch bugs early.');
    const grade = (t, b) => request(app).patch(`/api/quiz-attempts/${attemptId}/grade`).set(bearer(t)).send(b);
    expect((await grade(student.token, { grades: [{ question: full[1]._id, marks: 10 }] })).status).toBe(403);
    expect((await grade(teacher.token, { grades: [{ question: full[1]._id, marks: 11 }] })).status).toBe(400);
    expect((await grade(teacher.token, { grades: [{ question: full[0]._id, marks: 1 }] })).status).toBe(400); // MCQ is automatic
    const ok = await grade(teacher.token, { grades: [{ question: full[1]._id, marks: 8 }] });
    expect(ok.body.attempt).toMatchObject({ status: 'graded', score: 10, maxScore: 12, percent: 83 });
  });

  it('does not show a student the manager view of an attempt', async () => {
    const { student, attemptId } = await pending();
    const own = await request(app).get(`/api/quiz-attempts/${attemptId}`).set(bearer(student.token));
    expect(own.status).toBe(200);
    expect(own.body.attempt.answers).toBeUndefined();
    const rival = await createUserWithToken('student', 'r@test.dev');
    expect((await request(app).get(`/api/quiz-attempts/${attemptId}`).set(bearer(rival.token))).status).toBe(403);
  });
});

describe('editing and deleting', () => {
  it('blocks question changes once students have attempted, but allows other edits', async () => {
    const { teacher, student, quiz } = await world();
    const patch = (b) => request(app).patch(`/api/quizzes/${quiz._id}`).set(bearer(teacher.token)).send(b);
    expect((await patch({ questions: [mcq('Changed')] })).status).toBe(200);
    await start(student.token, quiz._id);
    expect((await patch({ questions: [mcq('Changed again')] })).status).toBe(409);
    expect((await patch({ title: 'Renamed quiz' })).body.quiz.title).toBe('Renamed quiz');
  });

  it('removes attempts with the quiz', async () => {
    const { teacher, student, quiz } = await world();
    await start(student.token, quiz._id);
    expect((await request(app).delete(`/api/quizzes/${quiz._id}`).set(bearer(teacher.token))).status).toBe(204);
    expect(await QuizAttempt.countDocuments()).toBe(0);
  });
});

describe('results', () => {
  async function gradedWorld() {
    const w = await world();
    const full = (await request(app).get(`/api/quizzes/${w.quiz._id}`).set(bearer(w.teacher.token))).body.quiz.questions;
    const attempt = await start(w.student.token, w.quiz._id);
    await submit(w.student.token, w.quiz._id, attempt.body.attempt.id, [correct(full[0]), correct(full[1])]);
    const a = (await request(app).post('/api/assignments').set(bearer(w.teacher.token)).send({
      courseId: w.course._id, title: 'Essay', description: 'Write it.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 20 })).body.assignment;
    const sub = (await request(app).post(`/api/assignments/${a._id}/submit`).set(bearer(w.student.token)).send({ answerText: 'Done' })).body.submission;
    await request(app).patch(`/api/submissions/${sub._id}/grade`).set(bearer(w.teacher.token)).send({ marks: 15 });
    return w;
  }

  it('lists a student’s own marks from quizzes and assignments', async () => {
    const { student } = await gradedWorld();
    const res = await request(app).get('/api/results').set(bearer(student.token));
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((r) => `${r.type}:${r.percent}`).sort()).toEqual(['assignment:75', 'quiz:100']);
    expect(res.body.averagePercent).toBe(88);
    const onlyQuiz = await request(app).get('/api/results?type=quiz').set(bearer(student.token));
    expect(onlyQuiz.body.total).toBe(1);
  });

  it('does not let one student see another’s results', async () => {
    const { student } = await gradedWorld();
    const rival = await createUserWithToken('student', 'r@test.dev');
    const res = await request(app).get(`/api/results?studentId=${student.user.id}`).set(bearer(rival.token));
    expect(res.body.total).toBe(0); // the studentId filter is ignored for students
  });

  it('shows instructors results for their own courses only, and parents their linked students’', async () => {
    const { teacher, student, course } = await gradedWorld();
    const other = await createUserWithToken('instructor', 'o@test.dev');
    const parent = await createUserWithToken('parent');
    const stranger = await createUserWithToken('parent', 'stranger@test.dev');
    parent.user.linkedStudents = [student.user.id];
    await parent.user.save();

    expect((await request(app).get('/api/results').set(bearer(teacher.token))).body.total).toBe(2);
    expect((await request(app).get('/api/results').set(bearer(other.token))).body.total).toBe(0);
    expect((await request(app).get(`/api/results?courseId=${course._id}`).set(bearer(other.token))).body.total).toBe(0);
    expect((await request(app).get(`/api/results?studentId=${student.user.id}`).set(bearer(parent.token))).body.total).toBe(2);
    expect((await request(app).get(`/api/results?studentId=${student.user.id}`).set(bearer(stranger.token))).status).toBe(403);
    expect((await request(app).get('/api/results').set(bearer(parent.token))).status).toBe(400);
    expect(await Assignment.countDocuments()).toBe(1);
  });
});
