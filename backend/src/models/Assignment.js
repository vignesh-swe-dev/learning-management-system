const mongoose = require('mongoose');
const { Schema } = mongoose;

const assignmentSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    dueAt: { type: Date, required: true },
    maxMarks: { type: Number, required: true, min: 1 },
    allowLate: { type: Boolean, default: false },
    latePenaltyPercent: { type: Number, default: 0, min: 0, max: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Assignment', assignmentSchema);
