const Joi = require('joi');

const password = Joi.string().min(8).max(72).required()
  .pattern(/[A-Za-z]/, 'letter').pattern(/\d/, 'number')
  .messages({ 'string.pattern.name': 'Password must contain at least one letter and one number' });

const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password,
  // Self-registration is limited to these roles; admins/instructors are created by an admin.
  role: Joi.string().valid('student', 'parent').default('student'),
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password,
});

module.exports = { register, login, password, changePassword };
