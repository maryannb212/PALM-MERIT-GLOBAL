import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import './Admin.css';

const EditMemberModal = ({ isOpen, onClose, member, onSave }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'user',
    has_paid_membership: false,
    wallet_balance: 0,
    available_balance: 0,
    held_balance: 0,
    referral_code: '',
    referred_by: '',
    referral_unlock_date: '',
    referral_expiry_date: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        role: member.role || 'user',
        has_paid_membership: member.has_paid_membership || false,
        wallet_balance: member.wallet_balance || 0,
        available_balance: member.available_balance || 0,
        held_balance: member.held_balance || 0,
        referral_code: member.referral_code || '',
        referred_by: member.referred_by || '',
        referral_unlock_date: member.referral_unlock_date ? member.referral_unlock_date.split('T')[0] : '',
        referral_expiry_date: member.referral_expiry_date ? member.referral_expiry_date.split('T')[0] : ''
      });
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(member.id, formData);
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>Edit Member Profile</h3>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>First Name</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Last Name</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
          </div>
          <div className="form-row" style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>System Role</label>
              <select name="role" value={formData.role} onChange={handleChange} className="refined-input">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '25px' }}>
              <input 
                type="checkbox" 
                name="has_paid_membership" 
                id="membership_toggle"
                checked={formData.has_paid_membership} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="membership_toggle" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold' }}>Premium Member</label>
            </div>
          </div>
          
          <div className="form-row" style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Wallet Balance (₦)</label>
              <input type="number" name="wallet_balance" value={formData.wallet_balance} onChange={handleChange} className="refined-input" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Available Balance (₦)</label>
              <input type="number" name="available_balance" value={formData.available_balance} onChange={handleChange} className="refined-input" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Held Balance (₦)</label>
              <input type="number" name="held_balance" value={formData.held_balance} onChange={handleChange} className="refined-input" />
            </div>
          </div>
          <details style={{ marginTop: '20px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <summary style={{ color: '#d4af37', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
              Referral Settings
            </summary>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Referral Code</label>
                <input type="text" name="referral_code" value={formData.referral_code} onChange={handleChange} placeholder="e.g. PMG-XXXX" className="refined-input" />
              </div>
              <div className="form-group">
                <label>Referred By (User ID)</label>
                <input type="text" name="referred_by" value={formData.referred_by} onChange={handleChange} placeholder="UUID of referrer (or leave blank)" className="refined-input" />
                <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Enter the user ID of the person who referred this member</small>
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Unlock Date</label>
                  <input type="date" name="referral_unlock_date" value={formData.referral_unlock_date} onChange={handleChange} className="refined-input" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Expiry Date</label>
                  <input type="date" name="referral_expiry_date" value={formData.referral_expiry_date} onChange={handleChange} className="refined-input" />
                </div>
              </div>
            </div>
          </details>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMemberModal;
