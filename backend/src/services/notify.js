const { Notification, Enrollment } = require('../models');
const realtime = require('./realtime');

// Stores a notification for each user and pushes it live to anyone who is connected.
async function notify(userIds, { title, body, type = 'system', link, createdBy }) {
  const unique = [...new Set(userIds.map(String))];
  if (!unique.length) return [];
  const docs = await Notification.insertMany(unique.map((user) => ({ user, title, body, type, link, createdBy })));
  docs.forEach((d) => realtime.toUser(d.user, 'notification:new', d.toJSON()));
  return docs;
}

async function enrolledStudentIds(courseId) {
  return (await Enrollment.find({ course: courseId, status: { $in: ['active', 'completed'] } }, 'student')).map((e) => e.student);
}
const notifyCourseStudents = async (courseId, payload) => notify(await enrolledStudentIds(courseId), payload);

module.exports = { notify, notifyCourseStudents, enrolledStudentIds };
