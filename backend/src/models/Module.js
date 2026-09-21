const mongoose = require('mongoose');
const { Schema } = mongoose;

const moduleSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
moduleSchema.index({ course: 1, order: 1 });
module.exports = mongoose.model('Module', moduleSchema);
