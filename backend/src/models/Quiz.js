const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'descriptive'], default: 'mcq' },
  options: [{ text: String, isCorrect: { type: Boolean, default: false } }],
  marks: { type: Number, default: 1, min: 0 },
});

const quizSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    timeLimitMin: { type: Number, min: 1 },
    maxAttempts: { type: Number, default: 1, min: 1 },
    isExam: { type: Boolean, default: false },
    questions: [questionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Quiz', quizSchema);
