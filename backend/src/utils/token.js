const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

module.exports = { signToken, verifyToken };
