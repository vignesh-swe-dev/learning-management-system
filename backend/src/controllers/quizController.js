const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Quiz, QuizAttempt } = require('../models');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');
const { notify } = require('../services/notify');
const { requireManager, requireStudentAccess, isManager, loadCourse, visibleCourseIds } = require('../services/courseAccess');

const GRACE_MS = 15000; // allowance for network delay when a timed attempt is submitted
const percent = (score, max) => (max ? Math.round((score * 100) / max) : 0);
const maxScoreOf = (quiz) => quiz.questions.reduce((n, q) => n + q.marks, 0);
const expiresAt = (quiz, attempt) => (quiz.timeLimitMin ? new Date(attempt.startedAt.getTime() + quiz.timeLimitMin * 60000) : null);

// Questions as a student sees them: never the correct answers.
const forStudent = (quiz) => quiz.questions.map((q) => ({
  _id: q._id, text: q.text, type: q.type, marks: q.marks,
  options: q.options.map((o) => ({ _id: o._id, text: o.text })),
}));

async function loadQuiz(id) {
  const quiz = await Quiz.findById(id);
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  return quiz;
}

// Scores the answers a student sent. Only the server decides what is correct.
function scoreAnswers(quiz, answers) {
  const questions = new Map(quiz.questions.map((q) => [q._id.toString(), q]));
  const seen = new Set();
  let score = 0;
  let pendingReview = false;
  const graded = answers.map((a) => {
    const q = questions.get(a.question);
    if (!q) throw new ApiError(400, 'An answer refers to a question that is not in this quiz');
    if (seen.has(a.question)) throw new ApiError(400, 'A question was answered more than once');
    seen.add(a.question);
    if (q.type === 'mcq') {
      if (!a.selectedOption) return { question: q._id, correct: false, marksAwarded: 0 };
      const opt = q.options.find((o) => o._id.toString() === a.selectedOption);
      if (!opt) throw new ApiError(400, 'An answer refers to an option that does not belong to its question');
      const marksAwarded = opt.isCorrect ? q.marks : 0;
      score += marksAwarded;
      return { question: q._id, selectedOption: opt._id, correct: opt.isCorrect, marksAwarded };
    }
    const text = (a.text || '').trim();
    if (text) pendingReview = true;
    return { question: q._id, text, marksAwarded: text ? undefined : 0 };
  });
  return { graded, score, pendingReview };
}

async function finalise(quiz, attempt, answers) {
  const { graded, score, pendingReview } = scoreAnswers(quiz, answers);
  attempt.answers = graded;
  attempt.score = score;
  attempt.maxScore = maxScoreOf(quiz);
  attempt.status = pendingReview ? 'submitted' : 'graded';
  attempt.submittedAt = new Date();
  await attempt.save();
  return attempt;
}

const summary = (attempt, quiz) => ({
  id: attempt.id, attemptNumber: attempt.attemptNumber, status: attempt.status, score: attempt.score, maxScore: attempt.maxScore,
  percent: percent(attempt.score, attempt.maxScore), pendingReview: attempt.status === 'submitted',
  results: attempt.answers.map((a) => ({ question: a.question, correct: a.correct })),
  submittedAt: attempt.submittedAt, quizTitle: quiz.title,
});

// ---- quiz management ----
exports.list = asyncHandler(async (req, res) => {
  const { user } = req;
  const { page, limit, skip } = parsePagination(req.query);
  const ids = await visibleCourseIds(user);
  const filter = {};
  if (ids) filter.course = { $in: ids };
  if (req.query.courseId) {
    if (ids && !ids.some((id) => id.equals(req.query.courseId))) return res.json({ data: [], page, limit, total: 0, pages: 0 });
    filter.course = req.query.courseId;
  }
  const [rows, total] = await Promise.all([
    Quiz.find(filter, '-questions.options').sort({ createdAt: -1 }).skip(skip).limit(limit).populate('course', 'title').lean(),
    Quiz.countDocuments(filter),
  ]);
  const qIds = rows.map((q) => q._id);
  const match = user.role === 'student' ? { quiz: { $in: qIds }, student: user._id } : { quiz: { $in: qIds } };
  const stats = await QuizAttempt.aggregate([
    { $match: match },
    { $group: { _id: '$quiz', attempts: { $sum: 1 }, best: { $max: { $cond: [{ $gt: ['$maxScore', 0] }, { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] }, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } } } },
  ]);
  const byQ = new Map(stats.map((s) => [s._id.toString(), s]));
  const data = rows.map(({ questions, ...q }) => {
    const s = byQ.get(q._id.toString());
    return { ...q, questionCount: questions.length, totalMarks: questions.reduce((n, x) => n + x.marks, 0),
      attemptsUsed: user.role === 'student' ? s?.attempts || 0 : undefined,
      bestPercent: user.role === 'student' && s ? Math.round(s.best) : undefined,
      attemptCount: user.role !== 'student' ? s?.attempts || 0 : undefined,
      pendingReviewCount: user.role !== 'student' ? s?.pending || 0 : undefined };
  });
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const { courseId, ...body } = req.body;
  await requireManager(req.user, courseId);
  const quiz = await Quiz.create({ ...body, course: courseId, createdBy: req.user._id });
  await logActivity({ user: req.user.id, action: 'quiz.create', entityType: 'Quiz', entityId: quiz.id, ip: req.ip });
  res.status(201).json({ quiz });
});

exports.getOne = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  const course = await loadCourse(quiz.course);
  if (isManager(req.user, course)) return res.json({ quiz, canManage: true });
  await requireStudentAccess(req.user, quiz.course);
  // Students get the rules and their history, but not the questions: those come with a started attempt.
  const attempts = await QuizAttempt.find({ quiz: quiz._id, student: req.user._id }).sort({ attemptNumber: 1 });
  res.json({
    quiz: { _id: quiz._id, title: quiz.title, timeLimitMin: quiz.timeLimitMin, maxAttempts: quiz.maxAttempts, isExam: quiz.isExam,
      questionCount: quiz.questions.length, totalMarks: maxScoreOf(quiz), course: quiz.course },
    attempts: attempts.map((a) => (a.status === 'in_progress' ? { id: a.id, attemptNumber: a.attemptNumber, status: a.status, startedAt: a.startedAt } : summary(a, quiz))),
    canManage: false,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await requireManager(req.user, quiz.course);
  if (req.body.questions && (await QuizAttempt.exists({ quiz: quiz._id }))) {
    throw new ApiError(409, 'Questions cannot be changed after students have attempted this quiz');
  }
  Object.assign(quiz, req.body);
  await quiz.save();
  res.json({ quiz });
});

exports.remove = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await requireManager(req.user, quiz.course);
  await QuizAttempt.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
  res.status(204).end();
});

// ---- attempts ----
exports.startAttempt = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students take quizzes');
  const quiz = await loadQuiz(req.params.id);
  await requireStudentAccess(req.user, quiz.course);

  const open = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id, status: 'in_progress' });
  if (open) {
    const end = expiresAt(quiz, open);
    if (!end || new Date() <= new Date(end.getTime() + GRACE_MS)) {
      return res.json({ attempt: { id: open.id, attemptNumber: open.attemptNumber, startedAt: open.startedAt, expiresAt: end }, questions: forStudent(quiz), resumed: true, draft: open.answers.map((a) => ({ question: String(a.question), selectedOption: a.selectedOption ? String(a.selectedOption) : undefined, text: a.text })) });
    }
    await finalise(quiz, open, []); // the timer ran out while the student was away
  }
  const used = await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id });
  if (used >= quiz.maxAttempts) throw new ApiError(403, `You have used all ${quiz.maxAttempts} attempt${quiz.maxAttempts === 1 ? '' : 's'}`);

  const attempt = await QuizAttempt.create({ quiz: quiz._id, student: req.user._id, attemptNumber: used + 1, maxScore: maxScoreOf(quiz) });
  await logActivity({ user: req.user.id, course: quiz.course, action: 'quiz.start', entityType: 'Quiz', entityId: quiz.id, meta: { title: quiz.title } });
  res.status(201).json({ attempt: { id: attempt.id, attemptNumber: attempt.attemptNumber, startedAt: attempt.startedAt, expiresAt: expiresAt(quiz, attempt) }, questions: forStudent(quiz), resumed: false });
});

// Autosave: keeps the student's in-progress answers on the server so a refresh or device switch loses nothing.
exports.saveAnswers = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id, student: req.user._id });
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.status !== 'in_progress') throw new ApiError(409, 'This attempt has already been submitted');
  const end = expiresAt(quiz, attempt);
  if (end && new Date() > new Date(end.getTime() + GRACE_MS)) throw new ApiError(400, 'The time limit has passed');
  attempt.answers = req.body.answers.map(({ question, selectedOption, text }) => ({ question, selectedOption, text }));
  await attempt.save();
  res.json({ saved: true, at: new Date().toISOString() });
});

exports.submitAttempt = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quiz: quiz._id, student: req.user._id });
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.status !== 'in_progress') throw new ApiError(409, 'This attempt has already been submitted');

  const end = expiresAt(quiz, attempt);
  if (end && new Date() > new Date(end.getTime() + GRACE_MS)) {
    await finalise(quiz, attempt, []);
    throw new ApiError(400, 'The time limit has passed, so this attempt was submitted without answers');
  }
  await finalise(quiz, attempt, req.body.answers);
  await logActivity({ user: req.user.id, course: quiz.course, action: 'quiz.submit', entityType: 'Quiz', entityId: quiz.id, meta: { score: attempt.score, max: attempt.maxScore, title: quiz.title } });
  realtime.toStaff(quiz.course, 'quiz:submitted', { studentId: req.user.id, studentName: req.user.name, courseId: String(quiz.course), quizId: quiz.id, title: quiz.title, pendingReview: attempt.status === 'submitted', at: new Date().toISOString() });
  realtime.dashboardUpdated(quiz.course);
  res.json({ attempt: summary(attempt, quiz) });
});

exports.listAttempts = asyncHandler(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  const course = await loadCourse(quiz.course);
  const { page, limit, skip } = parsePagination(req.query);
  const manager = isManager(req.user, course);
  if (!manager) await requireStudentAccess(req.user, quiz.course);
  const filter = { quiz: quiz._id, status: { $ne: 'in_progress' }, ...(manager ? {} : { student: req.user._id }) };
  const [rows, total] = await Promise.all([
    QuizAttempt.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).populate('student', 'name email'),
    QuizAttempt.countDocuments(filter),
  ]);
  res.json({ data: rows.map((a) => ({ ...summary(a, quiz), student: a.student })), page, limit, total, pages: Math.ceil(total / limit) });
});

// Attempt detail with the student's written answers, for grading or review.
exports.getAttempt = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.id).populate('student', 'name email');
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  const quiz = await loadQuiz(attempt.quiz);
  const course = await loadCourse(quiz.course);
  const manager = isManager(req.user, course);
  if (!manager && !attempt.student._id.equals(req.user._id)) throw new ApiError(403, 'You do not have access to this attempt');
  const answers = attempt.answers.map((a) => {
    const q = quiz.questions.id(a.question);
    return { question: a.question, text: q?.text, type: q?.type, marks: q?.marks, answerText: a.text, correct: a.correct, marksAwarded: a.marksAwarded,
      selectedOption: manager ? q?.options.find((o) => o._id.equals(a.selectedOption))?.text : undefined };
  });
  res.json({ attempt: { ...summary(attempt, quiz), student: attempt.student, answers: manager ? answers : undefined } });
});

exports.gradeAttempt = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.id);
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  const quiz = await loadQuiz(attempt.quiz);
  await requireManager(req.user, quiz.course);
  if (attempt.status === 'in_progress') throw new ApiError(409, 'This attempt has not been submitted yet');

  for (const { question, marks } of req.body.grades) {
    const q = quiz.questions.id(question);
    const answer = attempt.answers.find((a) => a.question.equals(question));
    if (!q || !answer) throw new ApiError(400, 'A grade refers to a question that was not answered');
    if (q.type !== 'descriptive') throw new ApiError(400, 'Multiple-choice questions are graded automatically');
    if (marks > q.marks) throw new ApiError(400, `Marks for a question cannot be more than ${q.marks}`);
    answer.marksAwarded = marks;
  }
  attempt.score = attempt.answers.reduce((n, a) => n + (a.marksAwarded || 0), 0);
  attempt.status = attempt.answers.every((a) => a.marksAwarded !== undefined && a.marksAwarded !== null) ? 'graded' : 'submitted';
  attempt.markModified('answers');
  await attempt.save();
  await logActivity({ user: req.user.id, course: quiz.course, action: 'quizattempt.grade', entityType: 'QuizAttempt', entityId: attempt.id });
  if (attempt.status === 'graded') await notify([attempt.student], { title: `Graded: ${quiz.title}`, body: `You scored ${attempt.score} of ${attempt.maxScore}.`, type: 'grade', link: `/quizzes/${quiz.id}`, createdBy: req.user._id });
  res.json({ attempt: summary(attempt, quiz) });
});
