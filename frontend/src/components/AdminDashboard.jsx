import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', employee_id: '', profile_picture: null });
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Report state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');  // for filtering/per-user PDF
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(null); // null or 'all' or employee_id

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/employees/');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.profile_picture) {
      alert("Please select a profile picture.");
      return;
    }
    const formData = new FormData();
    formData.append('name', newEmployee.name);
    formData.append('employee_id', newEmployee.employee_id);
    formData.append('profile_picture', newEmployee.profile_picture);
    try {
      await axios.post('http://127.0.0.1:8000/api/employees/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setNewEmployee({ name: '', employee_id: '', profile_picture: null });
      fetchEmployees();
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Failed to create employee. Make sure ID is unique.');
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editingEmployee.name);
    formData.append('employee_id', editingEmployee.employee_id);
    if (editingEmployee.profile_picture instanceof File) {
      formData.append('profile_picture', editingEmployee.profile_picture);
    }
    try {
      await axios.put(`http://127.0.0.1:8000/api/employees/${editingEmployee.id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/employees/${id}/`);
        fetchEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
      }
    }
  };

  // Fetch attendance logs (JSON for table display)
  const fetchAttendanceLogs = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    setLogsLoading(true);
    try {
      let url = `http://127.0.0.1:8000/api/attendance-logs/?start_date=${startDate}&end_date=${endDate}`;
      if (selectedEmployee) url += `&employee_id=${selectedEmployee}`;
      const response = await axios.get(url);
      setAttendanceLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // Download all-employee PDF
  const handleDownloadAllPDF = async () => {
    if (!startDate || !endDate) { alert("Select dates first."); return; }
    setPdfLoading('all');
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/attendance-report/?start_date=${startDate}&end_date=${endDate}`,
        { responseType: 'blob' }
      );
      triggerDownload(response.data, `attendance_all_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
      alert("Failed to download PDF.");
    } finally {
      setPdfLoading(null);
    }
  };

  // Download PDF for a specific employee
  const handleDownloadEmployeePDF = async (employeeId, employeeName) => {
    if (!startDate || !endDate) { alert("Select a date range first before downloading."); return; }
    setPdfLoading(employeeId);
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/attendance-employee-pdf/?start_date=${startDate}&end_date=${endDate}&employee_id=${employeeId}`,
        { responseType: 'blob' }
      );
      triggerDownload(response.data, `${employeeName}_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
      alert("Failed to download employee PDF.");
    } finally {
      setPdfLoading(null);
    }
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const statusBadge = (s) => {
    const color = s === 'PRESENT' ? '#27ae60' : s === 'CHECKOUT' ? '#e67e22' : '#e74c3c';
    return <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard — Nizan Makeovers</h2>

      {/* ── Employee Management ── */}
      <div className="dashboard-section">
        <h3>👥 Employee Management</h3>

        {!editingEmployee ? (
          <form className="employee-form" onSubmit={handleCreateEmployee}>
            <h4>Add New Employee</h4>
            <input type="text" placeholder="Full Name" value={newEmployee.name}
              onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})} required />
            <input type="text" placeholder="Employee ID" value={newEmployee.employee_id}
              onChange={(e) => setNewEmployee({...newEmployee, employee_id: e.target.value})} required />
            <input type="file" accept="image/*"
              onChange={(e) => setNewEmployee({...newEmployee, profile_picture: e.target.files[0]})} required />
            <button type="submit">Add Employee</button>
          </form>
        ) : (
          <form className="employee-form edit-form" onSubmit={handleUpdateEmployee}>
            <h4>Edit Employee</h4>
            <input type="text" value={editingEmployee.name}
              onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})} required />
            <input type="text" value={editingEmployee.employee_id}
              onChange={(e) => setEditingEmployee({...editingEmployee, employee_id: e.target.value})} required />
            <input type="file" accept="image/*"
              onChange={(e) => setEditingEmployee({...editingEmployee, profile_picture: e.target.files[0]})} />
            <button type="submit">Save Changes</button>
            <button type="button" className="cancel-btn" onClick={() => setEditingEmployee(null)}>Cancel</button>
          </form>
        )}

        <table className="employee-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Employee ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td>
                  {emp.profile_picture
                    ? <img src={emp.profile_picture} alt={emp.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                    : '—'}
                </td>
                <td>{emp.name}</td>
                <td>{emp.employee_id}</td>
                <td>
                  <button onClick={() => setEditingEmployee(emp)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDeleteEmployee(emp.id)}>Delete</button>
                  <button
                    className="pdf-btn"
                    onClick={() => handleDownloadEmployeePDF(emp.employee_id, emp.name)}
                    disabled={pdfLoading === emp.employee_id}
                  >
                    {pdfLoading === emp.employee_id ? '⏳' : '📥 PDF'}
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#999' }}>No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Attendance Reports ── */}
      <div className="dashboard-section">
        <h3>📊 Attendance Reports</h3>

        <div className="report-controls">
          <div>
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label>Filter Employee (optional)</label>
            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
              <option value="">— All Employees —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.employee_id}>{emp.name} ({emp.employee_id})</option>
              ))}
            </select>
          </div>
          <div className="report-btn-group">
            <button className="view-btn" onClick={fetchAttendanceLogs} disabled={logsLoading}>
              {logsLoading ? 'Loading...' : '🔍 View Report'}
            </button>
            <button className="download-btn" onClick={handleDownloadAllPDF} disabled={pdfLoading === 'all'}>
              {pdfLoading === 'all' ? 'Generating...' : '📄 Download All PDF'}
            </button>
          </div>
        </div>

        {attendanceLogs.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Status</th>
                  <th>Timestamp (IST)</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.map(log => (
                  <tr key={log.id}>
                    <td>{log.employee_name}</td>
                    <td>{log.employee_id}</td>
                    <td>{statusBadge(log.status)}</td>
                    <td>{log.timestamp}</td>
                    <td style={{ fontSize: '12px', color: '#888' }}>{log.failure_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: '#888', fontSize: '13px', marginTop: 8 }}>{attendanceLogs.length} record(s) found.</p>
          </div>
        )}

        {!logsLoading && attendanceLogs.length === 0 && startDate && endDate && (
          <p style={{ color: '#aaa', marginTop: 12 }}>No records found for the selected period.</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
