const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const Employee = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceWindow = require('../models/AttendanceWindow');
const { getDescriptor, findMatch } = require('../utils/faceRecognition');
const { generatePDF } = require('../utils/pdfGenerator');

// Haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/submit-attendance/
router.post('/submit-attendance/', async (req, res) => {
  const { employee_id, image, latitude, longitude, action = 'checkin' } = req.body;

  if (!employee_id || !image || latitude == null || longitude == null) {
    return res.status(400).json({ status: 'failed', message: 'Missing required fields' });
  }

  try {
    // 1. Find employee
    const employee = await Employee.findOne({ employee_id });
    if (!employee) {
      return res.json({ status: 'failed', message: 'Employee not found', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
    }

    // 2. Geofence check
    const window = await AttendanceWindow.findOne();
    if (window) {
      const distance = getDistance(parseFloat(latitude), parseFloat(longitude), window.latitude, window.longitude);
      if (distance > window.radius_meters) {
        await AttendanceLog.create({ employee: employee._id, status: 'FAILED', failure_reason: `Out of range (${Math.round(distance)}m away)` });
        return res.json({ status: 'failed', message: `You are outside the allowed area (${Math.round(distance / 1000, 1)}km away)`, timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
      }
    }

    // 3. Face recognition
    const descriptor = await getDescriptor(image);
    if (!descriptor) {
      await AttendanceLog.create({ employee: employee._id, status: 'FAILED', failure_reason: 'No face detected in image' });
      return res.json({ status: 'failed', message: 'No face detected in the image', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
    }

    const allEmployees = await Employee.find({ face_descriptor: { $exists: true, $ne: [] } });
    const match = findMatch(descriptor, allEmployees);
    if (!match || match.employee_id !== employee_id) {
      await AttendanceLog.create({ employee: employee._id, status: 'FAILED', failure_reason: 'Face verification failed' });
      return res.json({ status: 'failed', message: 'Face verification failed. Please try again.', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
    }

    // 4. Once-per-day check (IST)
    const todayIST = moment().tz('Asia/Kolkata').startOf('day').toDate();
    const tomorrowIST = moment().tz('Asia/Kolkata').endOf('day').toDate();

    if (action === 'checkin') {
      const existing = await AttendanceLog.findOne({ employee: employee._id, status: 'PRESENT', timestamp: { $gte: todayIST, $lte: tomorrowIST } });
      if (existing) {
        return res.json({ status: 'failed', message: 'You have already checked in today.', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
      }
      const log = await AttendanceLog.create({ employee: employee._id, status: 'PRESENT' });
      return res.json({ status: 'present', message: `Check-in successful! Welcome, ${employee.name}`, timestamp: moment(log.timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });

    } else if (action === 'checkout') {
      const checkin = await AttendanceLog.findOne({ employee: employee._id, status: 'PRESENT', timestamp: { $gte: todayIST, $lte: tomorrowIST } });
      if (!checkin) {
        return res.json({ status: 'failed', message: 'No check-in found for today.', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
      }
      const existing = await AttendanceLog.findOne({ employee: employee._id, status: 'CHECKOUT', timestamp: { $gte: todayIST, $lte: tomorrowIST } });
      if (existing) {
        return res.json({ status: 'failed', message: 'You have already checked out today.', timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
      }
      const log = await AttendanceLog.create({ employee: employee._id, status: 'CHECKOUT' });
      return res.json({ status: 'checkout', message: `Check-out successful! Goodbye, ${employee.name}`, timestamp: moment(log.timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') });
    }

    return res.status(400).json({ status: 'failed', message: 'Invalid action' });

  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ status: 'failed', message: 'Server error' });
  }
});

// GET /api/attendance-logs/
router.get('/attendance-logs/', async (req, res) => {
  const { start_date, end_date, employee_id } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });

  try {
    const startIST = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate();
    const endIST = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate();

    let query = { timestamp: { $gte: startIST, $lte: endIST } };
    if (employee_id) {
      const emp = await Employee.findOne({ employee_id });
      if (emp) query.employee = emp._id;
    }

    const logs = await AttendanceLog.find(query).populate('employee').sort({ timestamp: -1 });
    const data = logs.map(log => ({
      id: log._id,
      employee_name: log.employee?.name || '—',
      employee_id: log.employee?.employee_id || '—',
      status: log.status,
      timestamp: moment(log.timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      failure_reason: log.failure_reason || '',
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance-report/ — all employees PDF
router.get('/attendance-report/', async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });

  try {
    const startIST = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate();
    const endIST = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate();
    const logs = await AttendanceLog.find({ timestamp: { $gte: startIST, $lte: endIST } }).populate('employee').sort({ timestamp: 1 });

    const pdf = await generatePDF(logs, start_date, end_date, null);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="attendance_${start_date}_to_${end_date}.pdf"` });
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance-employee-pdf/ — single employee PDF
router.get('/attendance-employee-pdf/', async (req, res) => {
  const { start_date, end_date, employee_id } = req.query;
  if (!start_date || !end_date || !employee_id) return res.status(400).json({ error: 'start_date, end_date, and employee_id required' });

  try {
    const emp = await Employee.findOne({ employee_id });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const startIST = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate();
    const endIST = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate();
    const logs = await AttendanceLog.find({ employee: emp._id, timestamp: { $gte: startIST, $lte: endIST } }).populate('employee').sort({ timestamp: 1 });

    const pdf = await generatePDF(logs, start_date, end_date, emp.name);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${emp.name}_${start_date}_to_${end_date}.pdf"` });
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
