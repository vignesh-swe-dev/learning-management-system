const env = require('../config/env');

const notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `A record with that ${field} already exists`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (status >= 500) {
    console.error(err.stack || err); // never log request bodies, passwords or tokens
    if (env.isProd) message = 'Something went wrong on our side';
  }
  res.status(status).json({ message, ...(details ? { details } : {}) });
};
module.exports = { notFound, errorHandler };
