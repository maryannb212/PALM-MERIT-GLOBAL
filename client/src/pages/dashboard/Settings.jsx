import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FaUser, FaLock, FaBell, FaCamera, FaTrash } from 'react-icons/fa';

import './Dashboard.css';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // In a real app, you'd upload the image to a server (e.g. Cloudinary)
      // For now, we save it to the user state/localStorage
      updateUser({ ...profileData, profileImage });
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      setMessage('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMessage('Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <h2>Account Settings</h2>
        </header>

        <div className="settings-layout">
          <aside className="settings-nav card">
            <button 
              className={activeTab === 'profile' ? 'active' : ''} 
              onClick={() => setActiveTab('profile')}
            >
              <FaUser /> Profile Details
            </button>
            <button 
              className={activeTab === 'security' ? 'active' : ''} 
              onClick={() => setActiveTab('security')}
            >
              <FaLock /> Security & Password
            </button>
            <button 
              className={activeTab === 'notifications' ? 'active' : ''} 
              onClick={() => setActiveTab('notifications')}
            >
              <FaBell /> Notifications
            </button>
          </aside>

          <div className="settings-content card">
            {activeTab === 'profile' && (
              <div className="profile-settings">
                <h3>Edit Profile</h3>
                
                <div className="profile-image-upload">
                  <div className="avatar-preview-lg">
                    {profileImage ? (
                      <img src={profileImage} alt="Avatar" />
                    ) : (
                      <div className="avatar-placeholder-lg">{user?.firstName?.charAt(0)}</div>
                    )}
                    <button className="upload-trigger" onClick={() => fileInputRef.current.click()}>
                      <FaCamera />
                    </button>
                  </div>
                  <div className="upload-info">
                    <p className="text-bold">Profile Picture</p>
                    <p className="text-muted">JPG, GIF or PNG. Max size 2MB</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                      accept="image/*"
                    />
                    {profileImage && (
                      <button className="btn-text-danger" onClick={() => setProfileImage(null)}>
                        <FaTrash /> Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleProfileUpdate} className="settings-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>First Name</label>
                      <input 
                        type="text" 
                        value={profileData.firstName} 
                        onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input 
                        type="text" 
                        value={profileData.lastName} 
                        onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input type="email" value={profileData.email} disabled />
                      <small>Email cannot be changed.</small>
                    </div>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input 
                        type="tel" 
                        value={profileData.phone} 
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handlePasswordUpdate} className="settings-form">
                <h3>Change Password</h3>
                <div className="form-group">
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div className="notifications-settings">
                <h3>Notification Preferences</h3>
                <div className="toggle-group">
                  <label className="toggle-item">
                    <span>Email Notifications</span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="toggle-item">
                    <span>Transaction Alerts</span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="toggle-item">
                    <span>Marketing Updates</span>
                    <input type="checkbox" />
                  </label>
                </div>
              </div>
            )}

            {message && <p className={`form-message ${message.includes('success') ? 'success' : 'error'}`}>{message}</p>}
          </div>
        </div>
    </>
  );
};

export default Settings;
