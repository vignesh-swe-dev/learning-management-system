const Joi = require('joi');
const objectId = Joi.string().hex().length(24);
module.exports = {
  list: Joi.object({
    courseId: objectId, studentId: objectId, type: Joi.string().valid('assignment', 'quiz'),
    page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100),
  }),
};
