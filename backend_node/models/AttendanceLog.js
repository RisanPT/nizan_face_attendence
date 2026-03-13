const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  status: {
    type: String,
    enum: ['PRESENT', 'CHECKOUT', 'FAILED'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  failure_reason: { type: String, default: '' },
});

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
