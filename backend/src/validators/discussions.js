const Joi = require('joi');
const objectId = Joi.string().hex().length(24);
const page = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) };
module.exports = {
  list: Joi.object({ courseId: objectId.required(), ...page }),
  thread: Joi.object(page),
  create: Joi.object({ courseId: objectId.required(), title: Joi.string().trim().min(3).max(150).required(), body: Joi.string().trim().min(1).max(5000).required() }),
  reply: Joi.object({ body: Joi.string().trim().min(1).max(5000).required() }),
  moderate: Joi.object({ pinned: Joi.boolean(), locked: Joi.boolean() }).min(1),
};
