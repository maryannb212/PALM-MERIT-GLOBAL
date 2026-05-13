import React, { useState, useEffect } from 'react';
import {
  getAmbassadors,
  addAmbassador,
  updateAmbassador,
  deleteAmbassador,
  uploadMembershipReceipt
} from '../../services/api';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaUsers, FaUserTie, FaLayerGroup, FaImage } from 'react-icons/fa';
import './AdminAmbassadors.css';
import './Admin.css';

const AdminAmbassadors = () => {
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    bio: '',
    image_url: '',
    order_index: 0
  });

  const fetchAmbassadors = async () => {
    try {
      setLoading(true);
      const { data } = await getAmbassadors();
      setAmbassadors(data);
    } catch (error) {
      console.error('Error fetching ambassadors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('receipt', file);

    try {
      setProcessing(true);
      const { data } = await uploadMembershipReceipt(uploadData);
      setFormData({ ...formData, image_url: data.transaction.receipt_url });
    } catch (error) {
      console.error('Image upload failed', error);
      alert('Upload failed. Using manual URL instead.');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (ambassador = null) => {
    if (ambassador) {
      setEditingId(ambassador.id);
      setFormData({
        name: ambassador.name,
        role: ambassador.role,
        bio: ambassador.bio || '',
        image_url: ambassador.image_url || '',
        order_index: ambassador.order_index || 0
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', role: '', bio: '', image_url: '', order_index: 0 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      if (editingId) {
        await updateAmbassador(editingId, formData);
      } else {
        await addAmbassador(formData);
      }
      closeModal();
      fetchAmbassadors();
    } catch (error) {
      console.error('Save failed:', error);
      alert(error.response?.data?.message || 'Operation failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this ambassador from the public team page?')) return;
    try {
      await deleteAmbassador(id);
      fetchAmbassadors();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaUserTie /></div>
          <div>
            <h2>Ambassador & Team Management</h2>
            <p className="text-muted">Configure the public community leads and official representatives.</p>
          </div>
        </div>
        <div className="header-actions">
           <button className="btn-primary" onClick={() => openModal()}>
            <FaPlus /> Add New Lead
          </button>
        </div>
      </header>

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Fetching team members...</span>
          </div>
        ) : ambassadors.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">🤝</div>
            <h3>No Ambassadors Yet</h3>
            <p>Start building your public team by adding ambassadors.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Designated Role</th>
                  <th>Display Order</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ambassadors.map((amb) => (
                  <tr key={amb.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <img
                          src={amb.image_url || '/placeholder-avatar.png'}
                          alt={amb.name}
                          className="member-avatar"
                          onError={(e) => { e.target.src = '/placeholder-avatar.png'; }}
                          style={{ objectFit: 'cover' }}
                        />
                        <div className="member-info">
                          <span className="member-name">{amb.name}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge-pill pill-burgundy">{amb.role}</span></td>
                    <td><span className="count-badge">{amb.order_index}</span></td>
                    <td className="text-right">
                      <div className="action-buttons">
                        <button className="btn-icon btn-view" onClick={() => openModal(amb)}><FaEdit /></button>
                        <button className="btn-icon btn-reject" onClick={() => handleDelete(amb.id)}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content admin-modal-wide" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-header-title">
                <FaUserTie />
                <h3>{editingId ? 'Modify Ambassador' : 'Enlist New Ambassador'}</h3>
              </div>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="admin-refined-form">
              <div className="form-row-split">
                <div className="form-group">
                  <label className="field-label">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. John Doe"
                    className="refined-input full-width"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">Professional Role</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Regional Coordinator"
                    className="refined-input full-width"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="field-label">Avatar / Portrait URL</label>
                <div className="input-wrapper">
                  <FaImage className="input-icon" />
                  <input
                    type="text"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="refined-input"
                  />
                </div>
                <div className="mt-2">
                  <label className="btn-outline-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <FaPlus /> {processing ? 'Uploading...' : 'Upload Image'}
                    <input type="file" onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="field-label">Short Biography</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Tell the community about this ambassador..."
                  className="refined-textarea"
                ></textarea>
              </div>

              <div className="form-group">
                <label className="field-label"><FaLayerGroup /> Display Sequence</label>
                <input
                  type="number"
                  name="order_index"
                  value={formData.order_index}
                  onChange={handleInputChange}
                  className="refined-input full-width"
                />
                <small className="field-help">Lower values appear first on the public page.</small>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={processing}>
                   {processing ? 'Processing...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAmbassadors;
