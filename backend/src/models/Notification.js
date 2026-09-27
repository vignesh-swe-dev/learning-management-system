const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: String,
    type: { type: String, enum: ['announcement', 'attendance', 'assignment', 'grade', 'discussion', 'message', 'system'], default: 'system' },
    link: String, // in-app path the notification points to
    readAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
