const Joi = require('joi');
const objectId = Joi.string().hex().length(24);

module.exports = {
  active: Joi.object({ courseId: objectId }),
  activity: Joi.object({ courseId: objectId, page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) }),
  reports: Joi.object({
    period: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
    courseId: objectId,
    tzOffset: Joi.number().integer().min(-720).max(840).default(0), // minutes east of UTC, e.g. 330 for India
  }),
  dashboard: Joi.object({ studentId: objectId, since: Joi.date().iso(), tzOffset: Joi.number().integer().min(-720).max(840).default(0), allCourses: Joi.boolean() }),
};
