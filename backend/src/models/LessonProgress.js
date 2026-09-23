const mongoose = require('mongoose');
const { Schema } = mongoose;

const lessonProgressSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    watchedSec: { type: Number, default: 0, min: 0 },
    lastPositionSec: { type: Number, default: 0, min: 0 },
    startedAt: Date,
    lastReportedAt: Date, // used to bound how fast watch time can grow
    completedAt: Date,
  },
  { timestamps: true }
);
lessonProgressSchema.index({ student: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ course: 1, student: 1, status: 1 });
module.exports = mongoose.model('LessonProgress', lessonProgressSchema);
