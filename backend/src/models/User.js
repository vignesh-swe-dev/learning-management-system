const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = ['admin', 'instructor', 'student', 'parent'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    phone: { type: String, trim: true, maxlength: 20 },
    avatarUrl: { type: String },
    linkedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // parents only
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate all issued JWTs
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date }, // set once when a live connection ends; heartbeats are never stored
    shareLiveActivity: { type: Boolean, default: true }, // when false, instructors do not see this student's live status
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function compare(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
