const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Assignment, Submission, QuizAttempt, Quiz, Certificate } = require('../models');
const { parsePagination } = require('../utils/pagination');
const { visibleCourseIds } = require('../services/courseAccess');

const CAP = 500; // each source is capped before merging; use courseId/studentId filters for large courses
const pct = (score, max) => (max ? Math.round((score * 100) / max) : 0);

// Marks from assignments and quizzes in one list. Students see their own, parents their linked students',
// instructors their courses', admins everything.
exports.list = asyncHandler(async (req, res) => {
  const { user } = req;
  const { page, limit, skip } = parsePagination(req.query);
  const { courseId, type } = req.query;
  let studentId = req.query.studentId;

  if (user.role === 'student') studentId = user._id.toString();
  if (user.role === 'parent') {
    if (!studentId) throw new ApiError(400, 'studentId is required');
    if (!user.linkedStudents.some((id) => id.toString() === studentId)) throw new ApiError(403, 'You can only view results for your linked students');
  }
  let courseIds = user.role === 'instructor' ? await visibleCourseIds(user) : null;
  if (courseId) {
    if (courseIds && !courseIds.some((id) => id.equals(courseId))) return res.json({ data: [], page, limit, total: 0, pages: 0 });
    courseIds = [courseId];
  }
  const courseMatch = courseIds ? { course: { $in: courseIds } } : {};
  const studentMatch = studentId ? { student: studentId } : {};
  const items = [];

  if (type !== 'quiz') {
    const assignmentIds = courseIds ? (await Assignment.find(courseMatch, '_id')).map((a) => a._id) : null;
    const subs = await Submission.find({ status: 'graded', ...studentMatch, ...(assignmentIds ? { assignment: { $in: assignmentIds } } : {}) })
      .sort({ gradedAt: -1 }).limit(CAP)
      .populate({ path: 'assignment', select: 'title maxMarks course', populate: { path: 'course', select: 'title' } })
      .populate('student', 'name email');
    subs.filter((s) => s.assignment).forEach((s) => items.push({
      type: 'assignment', title: s.assignment.title, course: s.assignment.course, student: s.student,
      score: s.finalMarks, maxScore: s.assignment.maxMarks, percent: pct(s.finalMarks, s.assignment.maxMarks),
      status: 'graded', late: s.isLate, feedback: s.feedback, date: s.gradedAt,
    }));
  }
  if (type !== 'assignment') {
    const quizIds = courseIds ? (await Quiz.find(courseMatch, '_id')).map((q) => q._id) : null;
    const attempts = await QuizAttempt.find({ status: { $in: ['graded', 'submitted'] }, ...studentMatch, ...(quizIds ? { quiz: { $in: quizIds } } : {}) })
      .sort({ submittedAt: -1 }).limit(CAP)
      .populate({ path: 'quiz', select: 'title isExam course', populate: { path: 'course', select: 'title' } })
      .populate('student', 'name email');
    attempts.filter((a) => a.quiz).forEach((a) => items.push({
      type: 'quiz', title: a.quiz.title, isExam: a.quiz.isExam, course: a.quiz.course, student: a.student, attemptNumber: a.attemptNumber,
      score: a.score, maxScore: a.maxScore, percent: pct(a.score, a.maxScore),
      status: a.status === 'graded' ? 'graded' : 'pending_review', date: a.submittedAt,
    }));
  }
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  const graded = items.filter((i) => i.status === 'graded');
  const average = graded.length ? Math.round(graded.reduce((n, i) => n + i.percent, 0) / graded.length) : null;
  res.json({ data: items.slice(skip, skip + limit), page, limit, total: items.length, pages: Math.ceil(items.length / limit), averagePercent: average });
});

exports.myCertificates = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students have certificates');
  const data = await Certificate.find({ student: req.user._id }).sort({ issuedAt: -1 }).populate('course', 'title');
  res.json({ data });
});

// Public: lets an employer or school check a certificate ID.
exports.verifyCertificate = asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ verificationId: req.params.verificationId.toUpperCase() })
    .populate('student', 'name').populate('course', 'title');
  if (!cert) return res.status(404).json({ valid: false, message: 'No certificate matches this ID' });
  res.json({ valid: true, student: cert.student?.name, course: cert.course?.title, issuedAt: cert.issuedAt, verificationId: cert.verificationId });
});
