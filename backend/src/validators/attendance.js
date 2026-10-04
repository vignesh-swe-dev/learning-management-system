const Joi = require('joi');
const objectId = Joi.string().hex().length(24);
const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) };

const createSession = Joi.object({
  courseId: objectId.required(),
  title: Joi.string().trim().min(3).max(150).required(),
  startsAt: Joi.date().iso(),
  endsAt: Joi.date().iso().greater(Joi.ref('startsAt')),
  open: Joi.boolean().default(true), // false keeps it scheduled until the instructor opens it
});
const updateSession = Joi.object({ action: Joi.string().valid('open', 'close').required() });
const list = Joi.object({ courseId: objectId, status: Joi.string().valid('scheduled', 'open', 'closed'), ...paging });
const reports = Joi.object({ courseId: objectId, studentId: objectId, from: Joi.date().iso(), to: Joi.date().iso() });

module.exports = { createSession, updateSession, list, reports };
