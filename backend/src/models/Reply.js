const mongoose = require('mongoose');
const { Schema } = mongoose;

const replySchema = new Schema(
  {
    discussion: { type: Schema.Types.ObjectId, ref: 'Discussion', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);
replySchema.index({ discussion: 1, createdAt: 1 });
module.exports = mongoose.model('Reply', replySchema);
