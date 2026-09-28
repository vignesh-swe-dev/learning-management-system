const mongoose = require('mongoose');
const { Schema } = mongoose;

const discussionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    pinned: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
discussionSchema.index({ course: 1, pinned: -1, lastActivityAt: -1 });
module.exports = mongoose.model('Discussion', discussionSchema);
