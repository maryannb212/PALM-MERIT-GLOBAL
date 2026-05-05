import React, { useState } from 'react';

import { broadcastNotification } from '../../services/api';
import { FaBullhorn, FaPaperPlane, FaUserSecret } from 'react-icons/fa';
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
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      await broadcastNotification(formData);
      setStatus({ type: 'success', msg: 'Broadcast sent successfully!' });
      setFormData({ userId: '', title: '', message: '', type: 'SYSTEM' });
    } catch (error) {
      console.error('Broadcast error:', error);
      setStatus({ type: 'error', msg: 'Failed to send broadcast. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <div>
            <h2>Broadcast Notifications</h2>
            <p className="text-muted">Send alerts or announcements to platform members.</p>
          </div>
        </header>

        <div className="dashboard-section">
          <div className="admin-form-container card">
            <div className="card-header">
              <FaBullhorn /> Create New Announcement
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="form-group mb-3">
                <label>Target User (Leave empty for ALL users)</label>
                <div className="input-with-icon">
                  <FaUserSecret />
                  <input 
                    type="text" 
                    name="userId" 
                    value={formData.userId}
                    onChange={handleChange}
                    placeholder="Enter User UUID or leave blank"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label>Notification Type</label>
                <select 
                  name="type" 
                  value={formData.type} 
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="SYSTEM">System Alert</option>
                  <option value="PAYMENT">Payment Reminder</option>
                  <option value="PROMO">Promotion/Update</option>
                  <option value="ALERT">Critical Alert</option>
                </select>
              </div>

              <div className="form-group mb-3">
                <label>Title</label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title}
                  onChange={handleChange}
                  required 
                  placeholder="Notification Heading"
                  className="form-control"
                />
              </div>

              <div className="form-group mb-3">
                <label>Message Content</label>
                <textarea 
                  name="message" 
                  value={formData.message}
                  onChange={handleChange}
                  required 
                  rows="4"
                  placeholder="Type your message here..."
                  className="form-control"
                ></textarea>
              </div>

              {status.msg && (
                <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'} mb-3`}>
                  {status.msg}
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Processing...' : <><FaPaperPlane /> Send Broadcast</>}
              </button>
            </form>
          </div>
        </div>
    </>
  );
};

export default BroadcastPage;
