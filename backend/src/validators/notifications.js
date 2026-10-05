const Joi = require('joi');
module.exports = {
  list: Joi.object({ unread: Joi.boolean(), page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) }),
  announce: Joi.object({
    courseId: Joi.string().hex().length(24),
    title: Joi.string().trim().min(3).max(150).required(),
    body: Joi.string().trim().min(1).max(2000).required(),
  }),
};
