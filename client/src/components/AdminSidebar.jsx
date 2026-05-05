import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaShieldAlt, FaUsers, FaUserCheck, FaMoneyCheckAlt, FaTicketAlt, FaChartLine, FaSignOutAlt, FaUserCircle, FaExclamationTriangle, FaMoneyBillWave } from 'react-icons/fa';

const AdminSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNav = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const adminMenuItems = [
    { name: 'Admin Overview', path: '/admin/dashboard', icon: <FaChartLine /> },
    { name: 'User Management', path: '/admin/members', icon: <FaUsers /> },
    { name: 'KYC Requests', path: '/admin/kyc-queue', icon: <FaUserCheck /> },
    { name: 'Defaulters List', path: '/admin/defaulters', icon: <FaExclamationTriangle /> },
    { name: 'Financial Report', path: '/admin/reconciliation', icon: <FaMoneyCheckAlt /> },
    { name: 'Support Tickets', path: '/admin/tickets', icon: <FaTicketAlt /> },
    { name: 'Broadcast Notifications', path: '/admin/broadcast', icon: <FaShieldAlt /> },
    { name: 'Cash Flow Statement', path: '/admin/cashflow', icon: <FaMoneyBillWave /> },
    { name: 'Ambassadors', path: '/admin/ambassadors', icon: <FaUserCircle /> },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside className={`sidebar admin-sidebar-theme ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo" onClick={() => navigate('/admin/dashboard')} style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="Palm Merit" style={{ height: '35px', objectFit: 'contain' }} />
          </div>
          <button className="sidebar-mobile-close" onClick={onClose}>&times;</button>
        </div>
      
      <div className="sidebar-user admin-user-profile">
        <div className="sidebar-avatar">
          {user?.profileImage ? (
            <img src={user.profileImage} alt="Admin" />
          ) : (
            <div className="avatar-placeholder admin-avatar">{user?.firstName?.charAt(0)}</div>
          )}
        </div>
        <div className="sidebar-user-info">
          <p className="user-name">{user?.firstName} {user?.lastName}</p>
          <p className="user-role">Super Administrator</p>
        </div>
      </div>

      <ul className="sidebar-menu">
        <li className="menu-label">MANAGEMENT</li>
        {adminMenuItems.map((item) => (
          <li 
            key={item.path}
            className={location.pathname === item.path ? 'active' : ''} 
            onClick={() => handleNav(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-text">{item.name}</span>
          </li>
        ))}
        
        <li className="sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-icon"><FaSignOutAlt /></span>
          <span className="sidebar-text">System Logout</span>
        </li>
      </ul>
    </aside>
    </>
  );
};

export default AdminSidebar;
