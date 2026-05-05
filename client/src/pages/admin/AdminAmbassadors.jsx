import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaTimes } from 'react-icons/fa';
import './AdminAmbassadors.css';

const AdminAmbassadors = () => {
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    bio: '',
    image_url: '',
    order_index: 0
  });

  const fetchAmbassadors = async () => {
    try {
      const { data } = await axios.get('/api/ambassadors');
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
    uploadData.append('receipt', file); // Reuse the receipt upload middleware or create a specific one

    try {
      // Assuming a generic upload endpoint exists, or we use the membership receipt one for now
      // In a real scenario, you'd want a dedicated endpoint like POST /api/upload
      const { data } = await axios.post('/api/membership/upload-receipt', uploadData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      // The receipt endpoint returns the transaction with the URL. 
      // Ideally, create a dedicated /api/upload endpoint that just returns the URL.
      setFormData({ ...formData, image_url: data.transaction.receipt_url });
      alert('Image uploaded successfully');
    } catch (error) {
      console.error('Image upload failed', error);
      alert('Image upload failed. You can also manually paste an image URL.');
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
    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (editingId) {
        await axios.put(`/api/ambassadors/${editingId}`, formData, config);
        alert('Ambassador updated successfully');
      } else {
        await axios.post('/api/ambassadors', formData, config);
        alert('Ambassador added successfully');
      }
      closeModal();
      fetchAmbassadors();
    } catch (error) {
      console.error('Save failed:', error);
      alert(error.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ambassador?')) {
      try {
        const token = localStorage.getItem('adminToken');
        await axios.delete(`/api/ambassadors/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Ambassador deleted');
        fetchAmbassadors();
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Delete failed');
      }
    }
  };

  if (loading) return <div>Loading Ambassadors...</div>;

  return (
    <div className="admin-ambassadors">
      <div className="header-actions">
        <h2>Manage Ambassadors (Team Leads)</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus /> Add New
        </button>
      </div>

      <div className="table-responsive mt-4">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Role</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ambassadors.map((amb) => (
              <tr key={amb.id}>
                <td>
                  <img 
                    src={amb.image_url || '/placeholder-avatar.png'} 
                    alt={amb.name} 
                    className="amb-thumb"
                    onError={(e) => { e.target.src = '/placeholder-avatar.png'; }}
                  />
                </td>
                <td>{amb.name}</td>
                <td>{amb.role}</td>
                <td>{amb.order_index}</td>
                <td className="actions-cell">
                  <button className="btn-icon btn-edit" onClick={() => openModal(amb)}><FaEdit /></button>
                  <button className="btn-icon btn-delete" onClick={() => handleDelete(amb.id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
            {ambassadors.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center">No ambassadors found. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content admin-modal">
            <button className="modal-close" onClick={closeModal}><FaTimes /></button>
            <h3>{editingId ? 'Edit Ambassador' : 'Add Ambassador'}</h3>
            
            <form onSubmit={handleSubmit} className="ambassador-form">
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required 
                  className="form-control"
                />
              </div>
              
              <div className="form-group">
                <label>Role / Title</label>
                <input 
                  type="text" 
                  name="role" 
                  value={formData.role} 
                  onChange={handleInputChange} 
                  required 
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input 
                  type="text" 
                  name="image_url" 
                  value={formData.image_url} 
                  onChange={handleInputChange} 
                  placeholder="/uploads/filename.jpg or https://..."
                  className="form-control"
                />
                <small>Or upload a new image (Using receipt upload endpoint for now):</small>
                <input type="file" onChange={handleImageUpload} accept="image/*" className="form-control mt-2" />
              </div>

              <div className="form-group">
                <label>Bio (Optional)</label>
                <textarea 
                  name="bio" 
                  value={formData.bio} 
                  onChange={handleInputChange} 
                  rows="3"
                  className="form-control"
                ></textarea>
              </div>

              <div className="form-group">
                <label>Display Order (Lower numbers appear first)</label>
                <input 
                  type="number" 
                  name="order_index" 
                  value={formData.order_index} 
                  onChange={handleInputChange} 
                  className="form-control"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Ambassador</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAmbassadors;
