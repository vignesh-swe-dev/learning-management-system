const Joi = require('joi');
const objectId = Joi.string().hex().length(24);

const base = {
  title: Joi.string().trim().min(3).max(150),
  description: Joi.string().trim().min(5).max(10000),
  dueAt: Joi.date().iso().greater('now').messages({ 'date.greater': 'The deadline must be in the future' }),
  maxMarks: Joi.number().min(1).max(1000),
  allowLate: Joi.boolean(),
  latePenaltyPercent: Joi.number().min(0).max(100),
};
const create = Joi.object(base).keys({ courseId: objectId.required() })
  .fork(['title', 'description', 'dueAt', 'maxMarks'], (s) => s.required());
const update = Joi.object(base).min(1);
const list = Joi.object({
  courseId: objectId, page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100),
});
const submit = Joi.object({ answerText: Joi.string().allow('').max(10000) });
const grade = Joi.object({ marks: Joi.number().min(0).required(), feedback: Joi.string().allow('').max(5000) });
const page = Joi.object({ page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) });

module.exports = { create, update, list, submit, grade, page };
