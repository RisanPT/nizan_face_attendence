import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AttendanceCapture from './components/AttendanceCapture';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import './App.css';

const ProtectedAdminRoute = ({ children }) => {
  const isAuth = localStorage.getItem('isAdminAuthenticated') === 'true';
  return isAuth ? children : <Navigate to="/admin-login" replace />;
};

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuth = localStorage.getItem('isAdminAuthenticated') === 'true';
  const isAdminPage = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    localStorage.removeItem('isAdminAuthenticated');
    navigate('/admin-login');
  };

  return (
    <header className="App-header">
      <h1>Nizan Makeovers</h1>
      <nav>
        {isAdminPage && isAuth ? (
          <>
            <Link to="/admin" style={{ color: 'white', marginRight: '15px' }}>Dashboard</Link>
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' }}>
              Logout
            </button>
          </>
        ) : !isAdminPage ? (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Employee Attendance</span>
        ) : null}
      </nav>
    </header>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <AppHeader />
        <main>
          <Routes>
            <Route path="/" element={<AttendanceCapture />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

