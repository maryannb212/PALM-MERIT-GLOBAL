import React, { useState, useMemo } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminSidebar from './AdminSidebar';
import { FaBars, FaUserSecret, FaStopCircle } from 'react-icons/fa';
import '../pages/dashboard/Dashboard.css';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin');

  const impersonatedUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('palmmerit_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed.impersonatedBy ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  const stopImpersonating = () => {
    const backup = sessionStorage.getItem('palmmerit_user_backup');
    if (backup) {
      localStorage.setItem('palmmerit_user', backup);
      sessionStorage.removeItem('palmmerit_user_backup');
    } else {
      localStorage.removeItem('palmmerit_user');
    }
    window.location.href = '/admin/dashboard';
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="dashboard-container">
      {/* Mobile Header */}
      <header className="dashboard-mobile-header">
        <div className="mobile-logo">
          <img src="/logo.png" alt="Palm Merit" style={{ height: '30px', objectFit: 'contain' }} />
        </div>
        <button className="mobile-menu-toggle" onClick={toggleSidebar}>
          <FaBars />
        </button>
      </header>

      {isAdmin ? (
        <AdminSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      ) : (
        <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      )}

      {impersonatedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fef3c7', borderBottom: '2px solid #f59e0b',
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '12px', flexWrap: 'wrap'
        }}>
          <FaUserSecret style={{ color: '#d97706' }} />
          <span style={{ color: '#92400e', fontWeight: 600, fontSize: '0.85rem' }}>
            Impersonating <strong>{impersonatedUser.firstName} {impersonatedUser.lastName}</strong>
          </span>
          <button
            onClick={stopImpersonating}
            style={{
              background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <FaStopCircle /> Stop Impersonating
          </button>
        </div>
      )}
      <main className="dashboard-main" style={impersonatedUser ? { marginTop: '40px' } : {}}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
