const fs = require('fs/promises');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Assignment, Submission } = require('../models');
const uploads = require('../config/uploads');
const { MIME } = require('../services/fileValidation');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');
const { notify, notifyCourseStudents } = require('../services/notify');
const { requireManager, requireStudentAccess, isManager, loadCourse, visibleCourseIds } = require('../services/courseAccess');

const removeFile = (name) => fs.unlink(path.join(uploads.dirs.submission, name)).catch(() => {});

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
    Assignment.find(filter).sort({ dueAt: 1 }).skip(skip).limit(limit).populate('course', 'title').lean(),
    Assignment.countDocuments(filter),
  ]);
  const aIds = rows.map((a) => a._id);
  const now = new Date();
  let data;
  if (user.role === 'student') {
    const subs = await Submission.find({ student: user._id, assignment: { $in: aIds } }).lean();
    const byA = new Map(subs.map((s) => [s.assignment.toString(), s]));
    data = rows.map((a) => {
      const s = byA.get(a._id.toString());
      const state = s ? (s.status === 'graded' ? 'graded' : 'submitted') : now > a.dueAt ? (a.allowLate ? 'overdue' : 'closed') : 'pending';
      return { ...a, state, submission: s ? { status: s.status, isLate: s.isLate, marks: s.finalMarks, submittedAt: s.submittedAt } : null };
    });
  } else {
    const counts = await Submission.aggregate([
      { $match: { assignment: { $in: aIds } } },
      { $group: { _id: '$assignment', submitted: { $sum: 1 }, ungraded: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } } } },
    ]);
    const byA = new Map(counts.map((c) => [c._id.toString(), c]));
    data = rows.map((a) => ({ ...a, submissionCount: byA.get(a._id.toString())?.submitted || 0, ungradedCount: byA.get(a._id.toString())?.ungraded || 0 }));
  }
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const { courseId, ...body } = req.body;
  await requireManager(req.user, courseId);
  const assignment = await Assignment.create({ ...body, course: courseId, createdBy: req.user._id });
  await logActivity({ user: req.user.id, course: courseId, action: 'assignment.create', entityType: 'Assignment', entityId: assignment.id, ip: req.ip });
  await notifyCourseStudents(courseId, { title: `New assignment: ${assignment.title}`, body: `Due ${assignment.dueAt.toLocaleString('en-GB', { timeZone: 'UTC' })} UTC.`, type: 'assignment', link: `/assignments/${assignment.id}`, createdBy: req.user._id });
  res.status(201).json({ assignment });
});

exports.getOne = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate('course', 'title status instructors');
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  const manager = isManager(req.user, assignment.course);
  if (!manager) await requireStudentAccess(req.user, assignment.course._id);
  const out = { assignment };
  if (req.user.role === 'student') out.submission = await Submission.findOne({ assignment: assignment._id, student: req.user._id });
  res.json(out);
});

exports.update = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  await requireManager(req.user, assignment.course);
  Object.assign(assignment, req.body);
  await assignment.save();
  res.json({ assignment });
});

exports.remove = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  await requireManager(req.user, assignment.course);
  const subs = await Submission.find({ assignment: assignment._id });
  await Promise.all(subs.flatMap((s) => s.files.map((f) => removeFile(f.path))));
  await Submission.deleteMany({ assignment: assignment._id });
  await assignment.deleteOne();
  res.status(204).end();
});

exports.submit = asyncHandler(async (req, res) => {
  const { assignment, existingSubmission: existing, isLate } = req;
  const answerText = (req.body.answerText || '').trim();
  if (!req.file && !answerText) {
    throw new ApiError(400, 'Add an answer or attach a file before submitting');
  }
  const files = req.file
    ? [{ originalName: req.file.originalname, path: req.file.filename, size: req.file.size, mimeType: MIME[path.extname(req.file.filename).slice(1)] }]
    : (existing ? existing.files : []); // keep the earlier file if only the text changes

  let submission = existing;
  if (existing) {
    if (req.file) await Promise.all(existing.files.map((f) => removeFile(f.path)));
    Object.assign(existing, { files, answerText, submittedAt: new Date(), isLate });
    await existing.save();
  } else {
    submission = await Submission.create({ assignment: assignment._id, student: req.user._id, files, answerText, isLate });
  }
  await logActivity({ user: req.user.id, course: assignment.course, action: 'assignment.submit', entityType: 'Assignment', entityId: assignment.id, meta: { isLate, title: assignment.title } });
  realtime.toStaff(assignment.course, 'assignment:submitted', { studentId: req.user.id, studentName: req.user.name, courseId: String(assignment.course), assignmentId: assignment.id, title: assignment.title, isLate, at: new Date().toISOString() });
  realtime.dashboardUpdated(assignment.course);
  res.status(existing ? 200 : 201).json({ submission });
});

exports.listSubmissions = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  await requireManager(req.user, assignment.course);
  const { page, limit, skip } = parsePagination(req.query);
  const [data, total] = await Promise.all([
    Submission.find({ assignment: assignment._id }).sort({ submittedAt: -1 }).skip(skip).limit(limit).populate('student', 'name email'),
    Submission.countDocuments({ assignment: assignment._id }),
  ]);
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit), assignment });
});

// ---- submissions ----
async function submissionWithAssignment(id) {
  const submission = await Submission.findById(id);
  if (!submission) throw new ApiError(404, 'Submission not found');
  const assignment = await Assignment.findById(submission.assignment);
  return { submission, assignment };
}

exports.grade = asyncHandler(async (req, res) => {
  const { submission, assignment } = await submissionWithAssignment(req.params.id);
  await requireManager(req.user, assignment.course);
  const { marks, feedback } = req.body;
  if (marks > assignment.maxMarks) throw new ApiError(400, `Marks cannot be more than ${assignment.maxMarks}`);
  const penalty = submission.isLate ? assignment.latePenaltyPercent : 0;
  submission.marks = marks;
  submission.finalMarks = Math.round(marks * (1 - penalty / 100) * 100) / 100;
  submission.feedback = feedback;
  submission.status = 'graded';
  submission.gradedBy = req.user._id;
  submission.gradedAt = new Date();
  await submission.save();
  await logActivity({ user: req.user.id, course: assignment.course, action: 'submission.grade', entityType: 'Submission', entityId: submission.id, meta: { marks, penalty } });
  await notify([submission.student], { title: `Graded: ${assignment.title}`, body: `You scored ${submission.finalMarks} of ${assignment.maxMarks}.`, type: 'grade', link: `/assignments/${assignment.id}`, createdBy: req.user._id });
  realtime.dashboardUpdated(assignment.course);
  res.json({ submission });
});

exports.download = asyncHandler(async (req, res) => {
  const { submission, assignment } = await submissionWithAssignment(req.params.id);
  const course = await loadCourse(assignment.course);
  const owner = submission.student.equals(req.user._id);
  if (!owner && !isManager(req.user, course)) throw new ApiError(403, 'You do not have access to this file');
  const file = submission.files[0];
  if (!file) throw new ApiError(404, 'This submission has no file');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.download(path.join(uploads.dirs.submission, file.path), file.originalName, (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
  });
});
