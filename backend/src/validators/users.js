const Joi = require('joi');
const { password } = require('./auth');

const objectId = Joi.string().hex().length(24);
const roles = ['admin', 'instructor', 'student', 'parent'];

const create = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password,
  role: Joi.string().valid(...roles).required(),
  phone: Joi.string().trim().max(20).allow(''),
});

const adminUpdate = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }),
  role: Joi.string().valid(...roles),
  status: Joi.string().valid('active', 'suspended'),
  phone: Joi.string().trim().max(20).allow(''),
  linkedStudents: Joi.array().items(objectId),
  password: Joi.string().min(8).max(72),
}).min(1);

const selfUpdate = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(20).allow(''),
  shareLiveActivity: Joi.boolean(),
}).min(1);

const list = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  role: Joi.string().valid(...roles),
  q: Joi.string().trim().max(100),
});

module.exports = { create, adminUpdate, selfUpdate, list };
