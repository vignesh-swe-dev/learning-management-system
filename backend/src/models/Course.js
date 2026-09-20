const mongoose = require('mongoose');
const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true, index: true },
    thumbnail: String,
    instructors: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    durationHours: { type: Number, min: 0 },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
courseSchema.index({ title: 'text', description: 'text' });
module.exports = mongoose.model('Course', courseSchema);
