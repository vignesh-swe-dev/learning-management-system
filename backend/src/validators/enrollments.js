const Joi = require('joi');
const objectId = Joi.string().hex().length(24);

const create = Joi.object({ courseId: objectId.required(), studentId: objectId }); // studentId: admin only
const update = Joi.object({ status: Joi.string().valid('dropped').required() });

module.exports = { create, update };
