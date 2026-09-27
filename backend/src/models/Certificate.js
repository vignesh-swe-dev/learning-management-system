const mongoose = require('mongoose');
const { Schema } = mongoose;

const certificateSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    verificationId: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
certificateSchema.index({ student: 1, course: 1 }, { unique: true });
module.exports = mongoose.model('Certificate', certificateSchema);
