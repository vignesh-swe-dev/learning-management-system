const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const thumbnail = Joi.string().pattern(/^\/api\/thumbnails\/[a-f0-9]{32}\.(png|jpe?g|webp)$/).allow('', null);

const create = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  category: Joi.string().trim().min(2).max(60).required(),
  thumbnail,
  durationHours: Joi.number().min(0).max(1000),
  level: Joi.string().valid('beginner', 'intermediate', 'advanced'),
  instructors: Joi.array().items(objectId).unique(), // admin only; enforced in controller
});

const update = create.fork(['title', 'description', 'category'], (s) => s.optional())
  .keys({ status: Joi.string().valid('draft', 'published') })
  .min(1);

const list = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  q: Joi.string().trim().max(100),
  category: Joi.string().trim().max(60),
  level: Joi.string().valid('beginner', 'intermediate', 'advanced'),
  status: Joi.string().valid('draft', 'published'),
  mine: Joi.boolean(),
  sort: Joi.string().valid('newest', 'oldest', 'title'),
});

const enrollmentsList = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

module.exports = { create, update, list, enrollmentsList };
