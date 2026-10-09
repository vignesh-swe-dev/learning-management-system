const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ApiError = require('../utils/ApiError');

const isManager = (user, course) =>
  user.role === 'admin' ||
  (user.role === 'instructor' && course.instructors.some((id) => id.equals(user._id)));

async function isEnrolled(user, courseId) {
  if (user.role !== 'student') return false;
  return Boolean(await Enrollment.exists({ student: user._id, course: courseId, status: { $in: ['active', 'completed'] } }));
}

async function loadCourse(id) {
  const course = await Course.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  return course;
}

async function requireManager(user, courseId) {
  const course = await loadCourse(courseId);
  if (!isManager(user, course)) throw new ApiError(403, 'You do not manage this course');
  return course;
}

module.exports = { isManager, isEnrolled, loadCourse, requireManager };

// Students may use a course's assignments, quizzes and lessons only while enrolled in a published course.
async function requireStudentAccess(user, courseId) {
  const course = await loadCourse(courseId);
  if (course.status !== 'published' || !(await isEnrolled(user, course._id))) {
    throw new ApiError(403, 'Enroll in this course to use its content');
  }
  return course;
}

// Course ids the user may see content for: null means "all courses" (admin).
async function visibleCourseIds(user) {
  if (user.role === 'admin') return null;
  if (user.role === 'instructor') return (await Course.find({ instructors: user._id }, '_id')).map((c) => c._id);
  const enrollments = await Enrollment.find({ student: user._id, status: { $in: ['active', 'completed'] } }, 'course');
  const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) }, status: 'published' }, '_id');
  return courses.map((c) => c._id);
}

module.exports.requireStudentAccess = requireStudentAccess;
module.exports.visibleCourseIds = visibleCourseIds;
