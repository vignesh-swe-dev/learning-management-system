const mongoose = require('mongoose');
const { Schema } = mongoose;

// One document per instructor-controlled session; per-student join/leave is embedded.
// Durations are computed on the server from joinedAt/leftAt, never taken from clients.
const recordSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, required: true },
    leftAt: Date,
    durationSec: { type: Number, default: 0 },
  },
  { _id: false }
);

const attendanceSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['scheduled', 'open', 'closed'], default: 'scheduled' },
    startsAt: Date,
    endsAt: Date,
    openedAt: Date,
    closedAt: Date,
    records: [recordSchema],
  },
  { timestamps: true }
);
attendanceSchema.index({ course: 1, startsAt: -1 });
attendanceSchema.index({ 'records.student': 1 });
module.exports = mongoose.model('Attendance', attendanceSchema);
