const crypto = require('crypto');
const { Lesson, LessonProgress, Enrollment, Certificate } = require('../models');

async function courseProgress(studentId, courseId) {
  const [lessons, rows] = await Promise.all([
    Lesson.find({ course: courseId }, '_id').lean(),
    LessonProgress.find({ student: studentId, course: courseId }).lean(),
  ]);
  const byLesson = new Map(rows.map((r) => [r.lesson.toString(), r]));
  const completed = lessons.filter((l) => byLesson.get(l._id.toString())?.status === 'completed').length;
  return {
    total: lessons.length,
    completed,
    percent: lessons.length ? Math.round((completed * 100) / lessons.length) : 0,
    byLesson,
    lessons,
  };
}

// Keeps the enrollment status and certificate in step with the lessons a student has completed.
async function refreshCompletion(studentId, courseId) {
  const progress = await courseProgress(studentId, courseId);
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId, status: { $in: ['active', 'completed'] } });
  if (!enrollment) return progress;

  if (progress.total > 0 && progress.completed === progress.total) {
    if (enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      await enrollment.save();
    }
    await Certificate.findOneAndUpdate(
      { student: studentId, course: courseId },
      { $setOnInsert: { verificationId: crypto.randomBytes(8).toString('hex').toUpperCase(), issuedAt: new Date() } },
      { upsert: true }
    );
  } else if (enrollment.status === 'completed') {
    enrollment.status = 'active'; // a lesson was added after completion
    enrollment.completedAt = undefined;
    await enrollment.save();
  }
  return progress;
}

module.exports = { courseProgress, refreshCompletion };
