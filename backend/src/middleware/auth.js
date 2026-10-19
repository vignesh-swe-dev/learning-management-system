const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');
const User = require('../models/User');

// Resolves the user behind a bearer token. Also reused by Socket.IO auth in Phase 5.
async function userFromToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'Session is no longer valid');
  }
  return user;
}

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  req.user = await userFromToken(token);
  next();
});

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};

module.exports = { authenticate, authorize, userFromToken };
