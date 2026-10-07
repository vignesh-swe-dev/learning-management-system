const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => (req, _res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(new ApiError(400, 'Validation failed', details));
  }
  req[source] = value;
  next();
};
module.exports = validate;
