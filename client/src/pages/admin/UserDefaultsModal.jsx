import React, { useState, useEffect } from 'react';
import { FaTimes, FaExclamationTriangle, FaCheckCircle, FaEdit, FaSave } from 'react-icons/fa';
import { getUserDefaults, updateDefault, resolveUserDefaults } from '../../services/api';
import './Admin.css';

const UserDefaultsModal = ({ isOpen, onClose, userId, userName }) => {
  const [defaults, setDefaults] = useState([]);
  const [summary, setSummary] = useState({ outstanding: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (isOpen && userId) fetchDefaults();
  }, [isOpen, userId]);

  const fetchDefaults = async () => {
    try {
      setLoading(true);
      const { data } = await getUserDefaults(userId);
      setDefaults(data.defaults);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching user defaults:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (d) => {
    setEditingId(d.id);
    setEditValue(d.penalty_amount);
  };

  const handleSaveEdit = async (id) => {
    try {
      await updateDefault(id, { penalty_amount: parseFloat(editValue) || 0 });
      setEditingId(null);
      fetchDefaults();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update default');
    }
  };

  const handleResolve = async (id) => {
    if (!window.confirm('Mark this default as resolved?')) return;
    try {
      await updateDefault(id, { resolved: true });
      fetchDefaults();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve default');
    }
  };

  const handleResolveAll = async () => {
    if (!window.confirm(`Clear all ${summary.count} outstanding default(s) for ${userName}?`)) return;
    try {
      setResolving(true);
      await resolveUserDefaults(userId);
      fetchDefaults();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve defaults');
    } finally {
      setResolving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#1e293b' }}>
          <h3><FaExclamationTriangle style={{ color: '#fbbf24', marginRight: 8 }} /> Defaults: {userName}</h3>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>OUTSTANDING</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>₦{Number(summary.outstanding).toLocaleString()}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>UNRESOLVED COUNT</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{summary.count}</div>
            </div>
            {summary.count > 0 && (
              <button className="btn btn-primary" onClick={handleResolveAll} disabled={resolving}
                style={{ marginLeft: 'auto', background: '#059669', borderColor: '#059669' }}>
                <FaCheckCircle style={{ marginRight: 6 }} />{resolving ? 'Clearing...' : 'Clear All Defaults'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="table-loader"><div className="spinner-small"></div><span>Loading defaults...</span></div>
          ) : defaults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
              <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>No Defaults</h3>
              <p style={{ margin: 0 }}>This user has no default records.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Missed Date</th>
                    <th>Penalty Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {defaults.map((d) => (
                    <tr key={d.id} className="table-row-hover">
                      <td><span className="badge-pill pill-dark">{d.plan_name?.replace('_', ' ')}</span></td>
                      <td className="date-cell">{new Date(d.missed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        {editingId === d.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>₦</span>
                            <input type="number" className="refined-input" style={{ width: 100, height: 32 }}
                              value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                            <button className="btn btn-sm btn-primary" onClick={() => handleSaveEdit(d.id)} style={{ padding: '4px 8px' }}>
                              <FaSave /></button>
                            <button className="btn btn-sm" onClick={() => setEditingId(null)} style={{ padding: '4px 8px', background: '#e2e8f0' }}>
                              <FaTimes /></button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 600, color: '#dc2626' }}>₦{Number(d.penalty_amount).toLocaleString()}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status ${d.resolved ? 'status-verified' : 'status-unverified'}`}>
                          {d.resolved ? 'RESOLVED' : 'UNRESOLVED'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {!d.resolved && (
                            <>
                              <button className="btn btn-sm" onClick={() => handleEdit(d)}
                                title="Edit Amount" style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                                <FaEdit /></button>
                              <button className="btn btn-sm" onClick={() => handleResolve(d.id)}
                                title="Mark Resolved" style={{ padding: '4px 8px', fontSize: 12, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                                <FaCheckCircle /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDefaultsModal;