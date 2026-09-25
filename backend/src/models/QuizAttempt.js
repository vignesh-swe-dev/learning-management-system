const mongoose = require('mongoose');
const { Schema } = mongoose;

const quizAttemptSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    answers: [{ question: Schema.Types.ObjectId, selectedOption: Schema.Types.ObjectId, text: String, correct: Boolean, marksAwarded: Number }],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: true }
);
quizAttemptSchema.index({ quiz: 1, student: 1, attemptNumber: 1 }, { unique: true });
module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
