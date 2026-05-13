import React, { useState } from 'react';
import { broadcastNotification } from '../../services/api';
import { FaBullhorn, FaPaperPlane, FaUserSecret, FaRegBell, FaInfoCircle, FaShieldAlt } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const BroadcastPage = () => {
  const [formData, setFormData] = useState({
    userId: '',
    title: '',
    message: '',
    type: 'SYSTEM'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to send this broadcast? All targeted users will receive a notification.')) return;

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      await broadcastNotification(formData);
      setStatus({ type: 'success', msg: 'Broadcast successfully dispatched to the community.' });
      setFormData({ userId: '', title: '', message: '', type: 'SYSTEM' });
    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus({ type: 'error', msg: 'Communication failed. Please check network connectivity.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaBullhorn /></div>
          <div>
            <h2>Broadcast System</h2>
            <p className="text-muted">Communicate platform updates, payment reminders, or critical alerts.</p>
          </div>
        </div>
      </header>

      <div className="admin-grid-single">
        <div className="admin-card form-card">
          <div className="card-header-styled">
            <FaRegBell />
            <span>Create New Announcement</span>
          </div>

          <form onSubmit={handleSubmit} className="admin-refined-form">
            <div className="form-row-split">
              <div className="form-group">
                <label className="field-label">Target Audience</label>
                <div className="input-wrapper">
                  <FaUserSecret className="input-icon" />
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    onChange={handleChange}
                    placeholder="Global (Leave blank for ALL)"
                    className="refined-input"
                  />
                </div>
                <small className="field-help">Specify a User UUID for direct messaging, or leave empty for global broadcast.</small>
              </div>

              <div className="form-group">
                <label className="field-label">Notification Priority/Type</label>
                <div className="input-wrapper">
                  <FaShieldAlt className="input-icon" />
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="refined-select"
                  >
                    <option value="SYSTEM">📢 System Update</option>
                    <option value="PAYMENT">💳 Payment Reminder</option>
                    <option value="PROMO">✨ Program Promotion</option>
                    <option value="ALERT">⚠️ Critical Alert</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Announcement Heading</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Brief summary of the message..."
                className="refined-input full-width"
              />
            </div>

            <div className="form-group">
              <label className="field-label">Message Content</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Type your detailed message here. Be clear and professional..."
                className="refined-textarea"
              ></textarea>
            </div>

            {status.msg && (
              <div className={`notification-alert ${status.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {status.type === 'success' ? <FaCheckCircle /> : <FaInfoCircle />}
                <span>{status.msg}</span>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary btn-large" disabled={loading}>
                {loading ? (
                  <span className="spinner-inline"></span>
                ) : (
                  <><FaPaperPlane /> Dispatch Broadcast</>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-side-help">
          <h3>Communication Guidelines</h3>
          <div className="help-item">
            <span className="bullet"></span>
            <p>Ensure message titles are concise and informative.</p>
          </div>
          <div className="help-item">
            <span className="bullet"></span>
            <p>Use "Critical Alert" only for maintenance or security issues.</p>
          </div>
          <div className="help-item">
            <span className="bullet"></span>
            <p>Global broadcasts are sent to ALL registered members instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPage;
