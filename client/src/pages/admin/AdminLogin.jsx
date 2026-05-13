import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaLock, FaUserShield, FaShieldAlt } from 'react-icons/fa';
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
      setError(err.response?.data?.message || 'Invalid administrative credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page admin-login-bg">
      <div className="auth-container">
        <div className="auth-card admin-card-premium">
          <div className="auth-header">
            <div className="admin-badge-icon">
              <FaShieldAlt />
            </div>
            <h2>Administrative Portal</h2>
            <p>Authorized Personnel Only</p>
          </div>

          {error && (
            <div className="auth-alert error-burgundy">
              <FaLock size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-refined">
            <div className="form-group">
              <label htmlFor="username">Officer Username</label>
              <div className="input-group-styled">
                <FaUserShield className="input-icon-inner" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={credentials.username}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter system username"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Security Password</label>
              <div className="input-group-styled">
                <FaLock className="input-icon-inner" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter security key"
                />
              </div>
            </div>
            
            <button type="submit" className="btn-burgundy-gold btn-block" disabled={isLoading}>
              {isLoading ? (
                <span className="spinner-inline"></span>
              ) : (
                'Verify & Enter System'
              )}
            </button>
          </form>
          
          <div className="auth-footer-note">
             <small>Palm Merit Global Security Layer v2.4.0</small>
             <p>All activities are logged and monitored.</p>
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .admin-login-bg {
          background: radial-gradient(circle at center, #1a0006 0%, #000000 100%);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .admin-card-premium {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(212, 175, 55, 0.2);
          padding: 40px;
          border-radius: 20px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .admin-badge-icon {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #800020 0%, #d4af37 100%);
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: white;
          box-shadow: 0 0 20px rgba(128, 0, 32, 0.5);
        }
        .auth-header h2 { color: #d4af37; margin-bottom: 5px; }
        .auth-header p { color: #94a3b8; font-size: 0.9rem; }
        .error-burgundy {
          background: rgba(128, 0, 32, 0.15);
          color: #ff9999;
          padding: 12px;
          border-radius: 8px;
          border-left: 4px solid #800020;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
        }
        .input-group-styled {
          position: relative;
          width: 100%;
        }
        .input-icon-inner {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #d4af37;
        }
        .input-group-styled input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 14px 15px 14px 45px;
          border-radius: 10px;
          color: white;
          transition: 0.3s;
        }
        .input-group-styled input:focus {
          border-color: #d4af37;
          background: rgba(255, 255, 255, 0.08);
          outline: none;
        }
        .btn-burgundy-gold {
          background: linear-gradient(to right, #800020, #a00028);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 10px;
          width: 100%;
          font-weight: 700;
          cursor: pointer;
          margin-top: 20px;
          transition: 0.3s;
          border-bottom: 3px solid #d4af37;
        }
        .btn-burgundy-gold:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(128, 0, 32, 0.4); }
        .auth-footer-note { text-align: center; margin-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; }
        .auth-footer-note small { color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .auth-footer-note p { color: #475569; font-size: 0.75rem; margin-top: 5px; }
      `}</style>
    </div>
  );
};

export default AdminLogin;
