import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaLock, FaSave, FaExclamationTriangle } from 'react-icons/fa';
import { getPageLocks, updatePageLock } from '../../services/api';
import './Admin.css';

const ADMIN_PAGES = [
  { id: 'members', title: 'User Management' },
  { id: 'kyc-queue', title: 'KYC Requests' },
  { id: 'defaulters', title: 'Defaulters List' },
  { id: 'reconciliation', title: 'Financial Report' },
  { id: 'tickets', title: 'Support Tickets' },
  { id: 'broadcast', title: 'Broadcast Notifications' },
  { id: 'cashflow', title: 'Cash Flow Statement' },
  { id: 'ambassadors', title: 'Ambassadors' },
  { id: 'plans', title: 'Savings Plans' },
  { id: 'referrals', title: 'Referral Audits' },
  { id: 'payouts', title: 'Payout Management' },
];

const AdminSecurity = () => {
  const [locks, setLocks] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  
  // Local state for the forms
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchLocks();
  }, []);

  const fetchLocks = async () => {
    try {
      setLoading(true);
      const { data } = await getPageLocks();
      
      const locksMap = {};
      const initialForm = {};
      
      data.forEach(lock => {
        locksMap[lock.page_name] = lock;
        initialForm[lock.page_name] = { username: lock.username, password: '' };
      });
      
      ADMIN_PAGES.forEach(page => {
        if (!initialForm[page.id]) {
          initialForm[page.id] = { username: '', password: '' };
        }
      });
      
      setLocks(locksMap);
      setFormData(initialForm);
    } catch (error) {
      console.error('Error fetching page locks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (pageId, field, value) => {
    setFormData(prev => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        [field]: value
      }
    }));
  };

  const handleSave = async (pageId) => {
    const data = formData[pageId];
    if (!data.username || !data.password) {
      alert('Please provide both username and password to set a lock.');
      return;
    }

    try {
      setSavingId(pageId);
      await updatePageLock({
        page_name: pageId,
        username: data.username,
        password: data.password
      });
      
      alert('Security lock updated successfully!');
      
      // Clear password field after save
      setFormData(prev => ({
        ...prev,
        [pageId]: { ...prev[pageId], password: '' }
      }));
      
      fetchLocks(); // refresh status
    } catch (error) {
      console.error('Error saving lock:', error);
      alert(error.response?.data?.message || 'Failed to update lock.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon" style={{ background: '#1e293b' }}><FaShieldAlt color="#d4af37" /></div>
          <div>
            <h2>Security & Locks</h2>
            <p className="text-muted">Manage secondary passwords for individual admin sections</p>
          </div>
        </div>
      </header>

      <div className="notification-alert" style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', color: '#d4af37' }}>
        <FaExclamationTriangle />
        <span>
          <strong>CEO Notice:</strong> Setting a lock on a page requires any admin (including yourself) to enter the specific username and password for that page. The lock expires after 10 minutes of inactivity or immediately upon leaving the page.
        </span>
      </div>

      <div className="admin-card table-card" style={{ padding: '20px' }}>
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Loading security configurations...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {ADMIN_PAGES.map((page) => {
              const isLocked = !!locks[page.id];
              const form = formData[page.id] || { username: '', password: '' };
              
              return (
                <div key={page.id} style={{
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '1.1rem', margin: '0 0 5px 0' }}>
                      <FaLock color={isLocked ? '#10b981' : '#64748b'} /> {page.title}
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                      Status: <strong style={{ color: isLocked ? '#10b981' : '#f59e0b' }}>{isLocked ? 'Locked' : 'Unprotected'}</strong>
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '2', minWidth: '300px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Section Username</label>
                      <input 
                        type="text" 
                        placeholder="e.g. payout_master"
                        className="refined-input"
                        value={form.username}
                        onChange={(e) => handleInputChange(page.id, 'username', e.target.value)}
                        style={{ height: '38px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Section Password</label>
                      <input 
                        type="password" 
                        placeholder={isLocked ? 'Enter new password to change' : 'Set a password'}
                        className="refined-input"
                        value={form.password}
                        onChange={(e) => handleInputChange(page.id, 'password', e.target.value)}
                        style={{ height: '38px' }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <button 
                      className="btn btn-primary" 
                      style={{ height: '38px', alignSelf: 'flex-end', marginTop: '18px', background: isLocked ? '#1e293b' : '#800020', borderColor: isLocked ? '#475569' : '#800020' }}
                      onClick={() => handleSave(page.id)}
                      disabled={savingId === page.id}
                    >
                      <FaSave style={{ marginRight: '6px' }} />
                      {savingId === page.id ? 'Saving...' : (isLocked ? 'Update Lock' : 'Set Lock')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSecurity;
