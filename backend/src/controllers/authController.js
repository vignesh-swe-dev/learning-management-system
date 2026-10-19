const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { signToken } = require('../utils/token');
const { logActivity } = require('../services/audit');
const realtime = require('../services/realtime');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const user = await User.create({ name, email, password, role });
  await logActivity({ user: user.id, action: 'auth.register', ip: req.ip });
  res.status(201).json({ user, token: signToken(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email and wrong password to avoid account enumeration.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect email or password');
  }
  if (user.status !== 'active') throw new ApiError(403, 'This account has been suspended');
  user.lastLoginAt = new Date();
  await user.save();
  await logActivity({ user: user.id, action: 'auth.login', ip: req.ip });
  res.json({ user, token: signToken(user) });
});

// Bumping tokenVersion invalidates every token issued for this user.
exports.logout = asyncHandler(async (req, res) => {
  req.user.tokenVersion += 1;
  await req.user.save();
  await logActivity({ user: req.user.id, action: 'auth.logout', ip: req.ip });
  realtime.disconnectUser(req.user.id);
  res.json({ message: 'Signed out' });
});

exports.me = (req, res) => res.json({ user: req.user });

// Changing the password signs out every other session (and live connection) but keeps this one.
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Your current password is incorrect');
  if (req.body.currentPassword === req.body.newPassword) throw new ApiError(400, 'Choose a password you have not used before');
  user.password = req.body.newPassword;
  user.tokenVersion += 1;
  await user.save();
  realtime.disconnectUser(user.id);
  await logActivity({ user: user.id, action: 'auth.password_change', ip: req.ip });
  res.json({ token: signToken(user), message: 'Password updated' });
});
