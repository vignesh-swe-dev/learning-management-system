const mongoose = require('mongoose');
const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['video', 'pdf', 'document', 'image', 'text'], default: 'text' },
    content: String,
    resourceUrl: String,
    durationSec: { type: Number, min: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
lessonSchema.index({ module: 1, order: 1 });
lessonSchema.index({ course: 1 });
module.exports = mongoose.model('Lesson', lessonSchema);
