const { User, Course, Enrollment } = require('../models');

const ACTIVE = { $in: ['active', 'completed'] };

// Who may `user` message? Returns an array of user ids, or null meaning "any active user" (admin).
// Students and parents never get a list of classmates or other families.
async function contactIds(user) {
  if (user.role === 'admin') return null;
  const admins = (await User.find({ role: 'admin', status: 'active' }, '_id')).map((u) => u._id);
  let ids = [];
  if (user.role === 'student') {
    const enr = await Enrollment.find({ student: user._id, status: ACTIVE }, 'course');
    const courses = await Course.find({ _id: { $in: enr.map((e) => e.course) } }, 'instructors');
    ids = courses.flatMap((c) => c.instructors);
  } else if (user.role === 'parent') {
    const enr = await Enrollment.find({ student: { $in: user.linkedStudents || [] }, status: ACTIVE }, 'course');
    const courses = await Course.find({ _id: { $in: enr.map((e) => e.course) } }, 'instructors');
    ids = courses.flatMap((c) => c.instructors);
  } else if (user.role === 'instructor') {
    const courses = await Course.find({ instructors: user._id }, '_id instructors');
    const enr = await Enrollment.find({ course: { $in: courses.map((c) => c._id) }, status: ACTIVE }, 'student');
    const students = enr.map((e) => e.student);
    const parents = await User.find({ role: 'parent', linkedStudents: { $in: students } }, '_id');
    ids = [...courses.flatMap((c) => c.instructors), ...students, ...parents.map((p) => p._id)];
  }
  const set = new Map([...ids, ...admins].map((i) => [String(i), i]));
  set.delete(String(user._id));
  return [...set.values()];
}

async function canMessage(sender, recipientId) {
  if (String(sender._id) === String(recipientId)) return false;
  const recipient = await User.findById(recipientId, 'status');
  if (!recipient || recipient.status !== 'active') return false;
  const ids = await contactIds(sender);
  return ids === null || ids.some((i) => String(i) === String(recipientId));
}

module.exports = { contactIds, canMessage };
