const Joi = require('joi');

const report = Joi.object({
  watchedSec: Joi.number().min(0).max(86400),
  positionSec: Joi.number().min(0).max(86400),
  completed: Joi.boolean(),
});
const query = Joi.object({
  studentId: Joi.string().hex().length(24),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});
module.exports = { report, query };
