import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaWallet, FaBoxOpen, FaHistory, FaHeadset, FaUserShield, FaCog, FaSignOutAlt, FaShieldAlt, FaCloudUploadAlt, FaUserFriends, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
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

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <FaHome /> },
    { name: 'Fund Wallet', path: '/dashboard/wallet', icon: <FaWallet /> },
    { name: 'Cooperative Programs', path: '/dashboard/packages', icon: <FaBoxOpen /> },
    { name: 'Active Programs', path: '/dashboard/subscriptions', icon: <FaBoxOpen /> },
    { name: 'Clearance', path: '/dashboard/clearance', icon: <FaCheckCircle /> },
    { name: 'Defaults', path: '/dashboard/defaults', icon: <FaExclamationTriangle /> },
    { name: 'Transactions History', path: '/dashboard/transactions', icon: <FaHistory /> },
    { name: 'Upload Receipt', path: '/dashboard/receipt', icon: <FaCloudUploadAlt /> },
    { name: 'Referral Hub', path: '/dashboard/referrals', icon: <FaUserFriends /> },
    { name: 'Support', path: '/dashboard/support', icon: <FaHeadset /> },
    { name: 'Bank Details', path: '/dashboard/bank-details', icon: <FaShieldAlt /> },
    { name: 'Withdraw Funds', path: '/dashboard/withdraw', icon: <FaWallet /> },
    { name: 'Settings', path: '/dashboard/settings', icon: <FaCog /> },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="Palm Merit" style={{ height: '40px', objectFit: 'contain' }} />
          </div>
          <button className="sidebar-mobile-close" onClick={onClose}>&times;</button>
        </div>
      
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user?.profileImage ? (
            <img src={user.profileImage} alt="Profile" />
          ) : (
            <div className="avatar-placeholder">{user?.firstName?.charAt(0)}</div>
          )}
        </div>
        <div className="sidebar-user-info">
          <p className="user-name">{user?.firstName} {user?.lastName}</p>
          <p className="user-role">{user?.role === 'admin' ? 'Administrator' : 'Member'}</p>
        </div>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => (
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
          <span className="sidebar-text">Logout</span>
        </li>
      </ul>
    </aside>
    </>
  );
};

export default Sidebar;
