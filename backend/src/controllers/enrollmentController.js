const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Enrollment, Course, User, Lesson, LessonProgress } = require('../models');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');

exports.create = asyncHandler(async (req, res) => {
  const { user } = req;
  const { courseId, studentId } = req.body;
  let student = user;
  if (studentId && studentId !== user.id) {
    if (user.role !== 'admin') throw new ApiError(403, 'Only an admin can enroll another user');
    student = await User.findOne({ _id: studentId, role: 'student', status: 'active' });
    if (!student) throw new ApiError(404, 'Student not found');
  } else if (user.role !== 'student') {
    throw new ApiError(403, 'Only students can enroll in courses');
  }

  const course = await Course.findById(courseId);
  if (!course || course.status !== 'published') throw new ApiError(404, 'Course not found or not open for enrollment');

  let enrollment = await Enrollment.findOne({ student: student._id, course: course._id });
  if (enrollment && enrollment.status !== 'dropped') throw new ApiError(409, 'Already enrolled in this course');
  if (enrollment) {
    enrollment.status = 'active'; // re-enrolling after dropping
    await enrollment.save();
  } else {
    enrollment = await Enrollment.create({ student: student._id, course: course._id });
  }
  await logActivity({ user: user.id, course: course.id, action: 'enrollment.create', entityType: 'Course', entityId: course.id, ip: req.ip });
  realtime.joinCourse(student.id, course.id);
  realtime.toStaff(course.id, 'enrollment:created', { studentId: student.id, studentName: student.name, courseId: course.id });
  realtime.dashboardUpdated(course.id);
  res.status(201).json({ enrollment });
});

exports.myCourses = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students have enrolled courses');
  const enrollments = await Enrollment.find({ student: req.user._id, status: { $ne: 'dropped' } })
    .sort({ createdAt: -1 })
    .populate({ path: 'course', populate: { path: 'instructors', select: 'name' } });
  const live = enrollments.filter((e) => e.course);
  const courseIds = live.map((e) => e.course._id);
  const [totals, done] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: courseIds } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    LessonProgress.aggregate([{ $match: { student: req.user._id, course: { $in: courseIds }, status: 'completed' } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
  ]);
  const t = Object.fromEntries(totals.map((r) => [r._id, r.n]));
  const d = Object.fromEntries(done.map((r) => [r._id, r.n]));
  res.json({
    data: live.map((e) => {
      const total = t[e.course._id] || 0;
      const completed = Math.min(d[e.course._id] || 0, total);
      return { ...e.toJSON(), progress: { total, completed, percent: total ? Math.round((completed * 100) / total) : 0 } };
    }),
  });
});

exports.update = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  if (req.user.role !== 'admin' && !enrollment.student.equals(req.user._id)) {
    throw new ApiError(403, 'You can only change your own enrollments');
  }
  enrollment.status = req.body.status;
  await enrollment.save();
  realtime.leaveCourse(enrollment.student.toString(), enrollment.course.toString());
  realtime.dashboardUpdated(enrollment.course);
  res.json({ enrollment });
});
