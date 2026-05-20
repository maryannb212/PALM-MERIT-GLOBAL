import React, { useState } from 'react';
import { FaLock, FaShieldAlt } from 'react-icons/fa';
import { verifyPageLock } from '../../services/api';
import { useAdminLock } from '../../context/AdminLockContext';

const AdminLockScreen = ({ pageName, title }) => {
  const { unlockPage } = useAdminLock();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await verifyPageLock({ page_name: pageName, username, password });
      // Unlock the page with the returned token
      unlockPage(pageName, data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Access Denied. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '20px'
    }}>
      <div className="admin-card" style={{
        maxWidth: '400px',
        width: '100%',
        padding: '40px 30px',
        textAlign: 'center',
        borderTop: '4px solid #800020'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'rgba(128, 0, 32, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#800020'
        }}>
          <FaLock size={30} />
        </div>
        
        <h2 style={{ marginBottom: '10px', color: '#1e293b' }}>Security Check</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '30px' }}>
          The <strong style={{ color: '#800020' }}>{title || pageName}</strong> area is protected. Please enter the specific credentials for this section.
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#b91c1c',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left'
          }}>
            <FaShieldAlt /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Section Username</label>
            <input 
              type="text" 
              className="refined-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter section username"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '25px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Section Password</label>
            <input 
              type="password" 
              className="refined-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter section password"
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Unlock Section'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLockScreen;
