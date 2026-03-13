require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { initFaceApi } = require('./utils/faceRecognition');

const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Routes — same path prefix as Django backend
app.use('/api/employees', employeeRoutes);
app.use('/api', attendanceRoutes);

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Nizan Attendance API' }));

// Connect to MongoDB and start server
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize face-api.js models
    await initFaceApi();
    console.log('✅ Face API models loaded');

    // Seed attendance window
    const AttendanceWindow = require('./models/AttendanceWindow');
    const existing = await AttendanceWindow.findOne();
    if (!existing) {
      await AttendanceWindow.create({
        latitude: 11.2481,
        longitude: 75.8348,
        radius_meters: 10000,
      });
      console.log('✅ Attendance window seeded (Nizan Makeovers, 10 KM)');
    }

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

start();
