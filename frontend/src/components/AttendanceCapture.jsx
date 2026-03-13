import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '../api';
import './AttendanceCapture.css';

const AttendanceCapture = () => {
  const webcamRef = useRef(null);
  const [employeeId, setEmployeeId] = useState('');
  const [action, setAction] = useState('checkin');   // 'checkin' or 'checkout'
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'success' | 'error' | 'info'
  const [loading, setLoading] = useState(false);

  const setStatus = (msg, type = 'info') => {
    setStatusMsg(msg);
    setStatusType(type);
  };

  const capture = useCallback(() => {
    setStatus('Getting location...', 'info');
    setLoading(true);

    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser', 'error');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        submitAttendance(latitude, longitude);
      },
      (error) => {
        setStatus(`Location error: ${error.message}`, 'error');
        setLoading(false);
      }
    );
  }, [webcamRef, employeeId, action]);

  const submitAttendance = async (lat, lon) => {
    const imageSrc = webcamRef.current.getScreenshot();

    if (!imageSrc) {
      setStatus('Failed to capture image', 'error');
      setLoading(false);
      return;
    }

    setStatus('Submitting...', 'info');

    try {
      const response = await api.post('/api/submit-attendance/', {
        employee_id: employeeId,
        image: imageSrc,
        latitude: lat,
        longitude: lon,
        action: action
      });
      setStatus(`✅ ${response.data.message} — ${response.data.time}`, 'success');
    } catch (error) {
      if (error.response) {
        setStatus(`❌ ${error.response.data.error || 'Server Error'}`, 'error');
      } else {
        setStatus(`❌ ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const videoConstraints = {
    facingMode: 'user'
  };

  return (
    <div className="attendance-page">
      <div className="attendance-card">
        <h2>Nizan Makeovers</h2>
        <p className="attendance-subtitle">Face Recognition Attendance</p>

        {/* Check-In / Check-Out Toggle */}
        <div className="action-toggle">
          <button
            className={action === 'checkin' ? 'active-checkin' : ''}
            onClick={() => setAction('checkin')}
          >
            🟢 Check In
          </button>
          <button
            className={action === 'checkout' ? 'active-checkout' : ''}
            onClick={() => setAction('checkout')}
          >
            🔴 Check Out
          </button>
        </div>

        {/* Employee ID */}
        <input
          className="id-input"
          type="text"
          placeholder="Enter Employee ID"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />

        {/* Webcam */}
        <div className="webcam-wrapper">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{ width: '100%', height: 'auto' }}
          />
        </div>

        {/* Submit */}
        <button
          className={`submit-btn ${action === 'checkin' ? 'checkin' : 'checkout'}`}
          onClick={capture}
          disabled={loading || !employeeId}
        >
          {loading ? 'Processing...' : action === 'checkin' ? '📸 Mark Check-In' : '📸 Mark Check-Out'}
        </button>

        {/* Status */}
        {statusMsg && (
          <div className={`status-msg ${statusType}`}>
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCapture;
