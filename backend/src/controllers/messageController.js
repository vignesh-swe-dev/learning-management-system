const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Message, User } = require('../models');
const { contactIds, canMessage } = require('../services/messaging');
const realtime = require('../services/realtime');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.contacts = asyncHandler(async (req, res) => {
  const ids = await contactIds(req.user);
  const q = (req.query.q || '').trim();
  const filter = { status: 'active', _id: { $ne: req.user._id }, ...(ids ? { _id: { $in: ids } } : {}), ...(q ? { name: new RegExp(escapeRegex(q), 'i') } : {}) };
  const users = await User.find(filter, 'name role').sort({ name: 1 }).limit(50);
  res.json({ data: users.map((u) => ({ _id: u._id, name: u.name, role: u.role })) });
});

// One row per person you have talked to, newest first, with how many of their messages you have not read.
exports.conversations = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: me }, { recipient: me }] } },
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: { $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'] },
      last: { $first: '$$ROOT' },
      unread: { $sum: { $cond: [{ $and: [{ $eq: ['$recipient', me] }, { $not: ['$readAt'] }] }, 1, 0] } },
    } },
    { $sort: { 'last.createdAt': -1 } },
    { $limit: 100 },
  ]);
  const people = await User.find({ _id: { $in: rows.map((r) => r._id) } }, 'name role');
  const byId = new Map(people.map((p) => [String(p._id), p]));
  res.json({ data: rows.map((r) => ({ with: byId.get(String(r._id)) ? { _id: r._id, name: byId.get(String(r._id)).name, role: byId.get(String(r._id)).role } : { _id: r._id, name: 'Deleted user' },
    lastMessage: { body: r.last.body.slice(0, 120), at: r.last.createdAt, mine: String(r.last.sender) === String(me) }, unread: r.unread })) });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  res.json({ unread: await Message.countDocuments({ recipient: req.user._id, readAt: { $exists: false } }) });
});

exports.thread = asyncHandler(async (req, res) => {
  const other = req.params.userId;
  if (!mongoose.isValidObjectId(other)) throw new ApiError(400, 'Invalid user id');
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const pair = { $or: [{ sender: req.user._id, recipient: oid(other) }, { sender: oid(other), recipient: req.user._id }] };
  const filter = req.query.before ? { $and: [pair, { createdAt: { $lt: new Date(req.query.before) } }] } : pair;
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
  await Message.updateMany({ sender: oid(other), recipient: req.user._id, readAt: { $exists: false } }, { readAt: new Date() });
  const person = await User.findById(other, 'name role');
  res.json({ with: person ? { _id: person._id, name: person.name, role: person.role } : { _id: other, name: 'Deleted user' },
    data: rows.reverse().map((m) => ({ _id: m._id, body: m.body, createdAt: m.createdAt, mine: String(m.sender) === String(req.user._id) })), hasMore: rows.length === limit });
});

exports.send = asyncHandler(async (req, res) => {
  if (!(await canMessage(req.user, req.body.to))) throw new ApiError(403, 'You can’t message this person');
  const m = await Message.create({ sender: req.user._id, recipient: req.body.to, body: req.body.body });
  realtime.toUser(req.body.to, 'message:new', { _id: m.id, from: { _id: req.user.id, name: req.user.name }, body: m.body.slice(0, 120), createdAt: m.createdAt });
  res.status(201).json({ message: { _id: m._id, body: m.body, createdAt: m.createdAt, mine: true } });
});
