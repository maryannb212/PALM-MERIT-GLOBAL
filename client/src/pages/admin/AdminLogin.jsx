import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import '../auth/Auth.css';

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, ceoLogin } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await ceoLogin(credentials.username, credentials.password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid admin credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
      <div className="container">
        <div className="auth-card" style={{ maxWidth: '400px', margin: '0 auto', borderTop: '4px solid #3b82f6' }}>
          <div className="auth-header" style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#0f172a' }}>System Portal</h2>
            <p>Restricted Access</p>
          </div>

          {error && (
            <div className="auth-alert danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                required
                placeholder="Enter admin username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                required
                placeholder="Enter admin password"
              />
            </div>
            
            <Button type="submit" variant="primary" className="btn-block" style={{ marginTop: '20px' }}>
              {isLoading ? 'Authenticating...' : 'Access Portal'}
            </Button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
             <small style={{ color: '#64748b' }}>Unauthorized access is strictly prohibited.</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
