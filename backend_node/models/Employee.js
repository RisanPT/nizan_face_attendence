const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employee_id: { type: String, required: true, unique: true },
  profile_picture: { type: String, default: '' }, // Cloudinary URL
  face_descriptor: { type: [Number], default: [] }, // 128-float face encoding
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
