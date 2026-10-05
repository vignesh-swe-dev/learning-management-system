const Joi = require('joi');
const objectId = Joi.string().hex().length(24);
module.exports = {
  contacts: Joi.object({ q: Joi.string().trim().max(60).allow('') }),
  thread: Joi.object({ before: Joi.date().iso(), limit: Joi.number().integer().min(1).max(100) }),
  send: Joi.object({ to: objectId.required(), body: Joi.string().trim().min(1).max(2000).required() }),
};
