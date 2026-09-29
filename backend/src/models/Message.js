const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: Date,
  },
  { timestamps: true }
);
messageSchema.index({ recipient: 1, readAt: 1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
module.exports = mongoose.model('Message', messageSchema);
