const Joi = require('joi');

const resourceUrl = Joi.alternatives(
  Joi.string().pattern(/^\/api\/files\/[a-f0-9]{32}\.[a-z0-9]{2,5}$/), // uploaded through /api/uploads/resource
  Joi.string().uri({ scheme: ['https'] }).max(500) // external link
);

const moduleCreate = Joi.object({ title: Joi.string().trim().min(2).max(150).required() });
const moduleUpdate = Joi.object({
  title: Joi.string().trim().min(2).max(150),
  order: Joi.number().integer().min(0),
}).min(1);

const lessonBase = {
  title: Joi.string().trim().min(2).max(150),
  type: Joi.string().valid('video', 'pdf', 'document', 'image', 'text'),
  content: Joi.string().allow('').max(50000),
  resourceUrl,
  durationSec: Joi.number().integer().min(0).max(86400),
  order: Joi.number().integer().min(0),
};

const lessonCreate = Joi.object(lessonBase).fork(['title', 'type'], (s) => s.required())
  .when(Joi.object({ type: 'text' }).unknown(), {
    then: Joi.object({ content: Joi.string().min(1).required() }),
    otherwise: Joi.object({ resourceUrl: Joi.required() }),
  });

const lessonUpdate = Joi.object(lessonBase).min(1);

module.exports = { moduleCreate, moduleUpdate, lessonCreate, lessonUpdate };
