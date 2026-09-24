const mongoose = require('mongoose');
const { Schema } = mongoose;

const submissionSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    files: [{ originalName: String, path: String, size: Number, mimeType: String }],
    answerText: String,
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
    marks: { type: Number, min: 0 }, // as awarded by the grader
    finalMarks: { type: Number, min: 0 }, // after any late penalty
    feedback: String,
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    gradedAt: Date,
  },
  { timestamps: true }
);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ student: 1, status: 1 });
module.exports = mongoose.model('Submission', submissionSchema);
