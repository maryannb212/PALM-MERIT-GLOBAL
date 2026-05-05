import React, { useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminSidebar from './AdminSidebar';
import { FaBars } from 'react-icons/fa';
import '../pages/dashboard/Dashboard.css';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

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

      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
