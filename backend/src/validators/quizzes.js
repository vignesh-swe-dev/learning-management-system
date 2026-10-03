const Joi = require('joi');
const objectId = Joi.string().hex().length(24);

const question = Joi.object({
  text: Joi.string().trim().min(3).max(1000).required(),
  type: Joi.string().valid('mcq', 'descriptive').default('mcq'),
  marks: Joi.number().min(0).max(100).default(1),
  options: Joi.when('type', {
    is: 'descriptive',
    then: Joi.array().max(0).default([]),
    otherwise: Joi.array().items(Joi.object({
      text: Joi.string().trim().min(1).max(300).required(),
      isCorrect: Joi.boolean().default(false),
    })).min(2).max(6).required(),
  }),
}).custom((q, helpers) => (
  q.type === 'mcq' && q.options.filter((o) => o.isCorrect).length !== 1
    ? helpers.message('Each multiple-choice question needs exactly one correct option')
    : q
));

const base = {
  title: Joi.string().trim().min(3).max(150),
  timeLimitMin: Joi.number().integer().min(1).max(600).allow(null),
  maxAttempts: Joi.number().integer().min(1).max(10),
  isExam: Joi.boolean(),
  questions: Joi.array().items(question).min(1).max(100),
};
const create = Joi.object(base).keys({ courseId: objectId.required() })
  .fork(['title', 'questions'], (s) => s.required());
const update = Joi.object(base).min(1);
const list = Joi.object({ courseId: objectId, page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) });
const submitAttempt = Joi.object({
  answers: Joi.array().items(Joi.object({
    question: objectId.required(),
    selectedOption: objectId,
    text: Joi.string().allow('').max(10000),
  })).max(100).required(),
});
const gradeAttempt = Joi.object({
  grades: Joi.array().items(Joi.object({ question: objectId.required(), marks: Joi.number().min(0).required() })).min(1).required(),
});

module.exports = { create, update, list, submitAttempt, gradeAttempt };
