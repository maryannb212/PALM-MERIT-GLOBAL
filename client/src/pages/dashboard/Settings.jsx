import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadProfileImage, removeProfileImage } from '../../services/api';
import { FaUser, FaLock, FaBell, FaCamera, FaTrash } from 'react-icons/fa';

import './Dashboard.css';

const Settings = () => {
  const { user, updateUser, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [message, setMessage] = useState('');
  
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

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setImageLoading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('profileImage', file);
      const { data } = await uploadProfileImage(formData);
      // Update user context with the new image URL from the server
      updateUser({ profileImage: data.profileImage });
      setMessage('Profile picture updated successfully!');
    } catch (err) {
      console.error('Image upload error:', err);
      setMessage('Failed to upload image. Please try again.');
    } finally {
      setImageLoading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async () => {
    setImageLoading(true);
    setMessage('');
    try {
      await removeProfileImage();
      updateUser({ profileImage: null });
      setMessage('Profile picture removed.');
    } catch (err) {
      setMessage('Failed to remove image.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      updateUser({ ...profileData });
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

  const currentImage = user?.profileImage || null;

  return (
    <>
        <header className="dashboard-header">
          <h2>Account Settings</h2>
        </header>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Sidebar Nav */}
          <aside style={{
            flex: '0 0 220px',
            background: 'white',
            borderRadius: '16px',
            padding: '12px',
            border: '1px solid #edf2f7',
            alignSelf: 'flex-start'
          }}>
            <button 
              onClick={() => setActiveTab('profile')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '12px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: activeTab === 'profile' ? '700' : '500',
                background: activeTab === 'profile' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'profile' ? 'white' : '#475569',
                marginBottom: '4px', transition: 'all 0.2s'
              }}
            >
              <FaUser /> Profile Details
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '12px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: activeTab === 'security' ? '700' : '500',
                background: activeTab === 'security' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'security' ? 'white' : '#475569',
                marginBottom: '4px', transition: 'all 0.2s'
              }}
            >
              <FaLock /> Security & Password
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '12px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: activeTab === 'notifications' ? '700' : '500',
                background: activeTab === 'notifications' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'notifications' ? 'white' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              <FaBell /> Notifications
            </button>
          </aside>

          {/* Main Content */}
          <div style={{
            flex: '1 1 400px',
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            border: '1px solid #edf2f7'
          }}>
            {activeTab === 'profile' && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.2rem', color: '#1e293b' }}>Edit Profile</h3>
                
                {/* Profile Image Upload */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '20px',
                  padding: '20px', background: '#f8fafc', borderRadius: '12px',
                  border: '1px solid #edf2f7', marginBottom: '28px', flexWrap: 'wrap'
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '100px', height: '100px', borderRadius: '50%',
                      overflow: 'hidden', background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '3px solid #edf2f7'
                    }}>
                      {currentImage ? (
                        <img 
                          src={currentImage} 
                          alt="Profile" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '2.2rem', color: 'white', fontWeight: '800' }}>
                          {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={imageLoading}
                      style={{
                        position: 'absolute', bottom: '0', right: '0',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--color-primary)', color: 'white', border: '2px solid white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '0.8rem'
                      }}
                    >
                      <FaCamera />
                    </button>
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '700', color: '#1e293b' }}>Profile Picture</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                      JPG, GIF or PNG. Max size 2MB
                    </p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                      accept="image/*"
                    />
                    {imageLoading && (
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                        Uploading...
                      </p>
                    )}
                    {currentImage && !imageLoading && (
                      <button 
                        onClick={handleRemoveImage}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          gap: '5px', fontSize: '0.85rem', padding: 0, fontWeight: '600'
                        }}
                      >
                        <FaTrash /> Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleProfileUpdate}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
                      <input type="email" value={profileData.email} disabled style={{ opacity: 0.6 }} />
                      <small style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Email cannot be changed.</small>
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
              <form onSubmit={handlePasswordUpdate}>
                <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.2rem', color: '#1e293b' }}>Change Password</h3>
                <div style={{ maxWidth: '400px' }}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Current Password</label>
                    <input 
                      type="password" 
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>New Password</label>
                    <input 
                      type="password" 
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label>Confirm New Password</label>
                    <input 
                      type="password" 
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.2rem', color: '#1e293b' }}>Notification Preferences</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Email Notifications', defaultOn: true },
                    { label: 'Transaction Alerts', defaultOn: true },
                    { label: 'Marketing Updates', defaultOn: false }
                  ].map((item) => (
                    <label key={item.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px', background: '#f8fafc', borderRadius: '10px',
                      border: '1px solid #edf2f7', cursor: 'pointer'
                    }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: '500', color: '#334155' }}>{item.label}</span>
                      <input type="checkbox" defaultChecked={item.defaultOn} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {message && (
              <p style={{
                marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
                fontSize: '0.9rem', fontWeight: '600',
                background: message.includes('success') || message.includes('updated') || message.includes('removed') ? '#d1fae5' : '#fee2e2',
                color: message.includes('success') || message.includes('updated') || message.includes('removed') ? '#065f46' : '#991b1b'
              }}>
                {message}
              </p>
            )}
          </div>
        </div>
    </>
  );
};

export default Settings;
