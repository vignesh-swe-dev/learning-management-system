const { Course, Module, Lesson, LessonProgress, Enrollment, Assignment, Submission, Quiz, QuizAttempt, Attendance, Certificate, Discussion, Reply } =
  require('../models');

// Removes a course and everything that hangs off it.
async function deleteCourseCascade(courseId) {
  const [assignments, quizzes] = await Promise.all([
    Assignment.find({ course: courseId }, '_id'),
    Quiz.find({ course: courseId }, '_id'),
  ]);
  await Promise.all([
    Submission.deleteMany({ assignment: { $in: assignments.map((a) => a._id) } }),
    QuizAttempt.deleteMany({ quiz: { $in: quizzes.map((q) => q._id) } }),
    Assignment.deleteMany({ course: courseId }),
    Quiz.deleteMany({ course: courseId }),
    Lesson.deleteMany({ course: courseId }),
    Module.deleteMany({ course: courseId }),
    LessonProgress.deleteMany({ course: courseId }),
    Enrollment.deleteMany({ course: courseId }),
    Attendance.deleteMany({ course: courseId }),
    Certificate.deleteMany({ course: courseId }),
    Discussion.deleteMany({ course: courseId }),
    Reply.deleteMany({ course: courseId }),
  ]);
  await Course.findByIdAndDelete(courseId);
}
module.exports = { deleteCourseCascade };
