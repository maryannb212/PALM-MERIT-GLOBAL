import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket, getMyTickets } from '../../services/api';

import './Dashboard.css';

const Support = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data } = await getMyTickets();
        setTickets(data);
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await createTicket(formData);
      setTickets([data, ...tickets]);
      setShowCreate(false);
      setFormData({ title: '', description: '', priority: 'medium' });
    } catch (err) {
      alert('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <h2>Support Tickets</h2>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'View My Tickets' : 'Create New Ticket'}
          </button>
        </header>

        <div className="card ticket-info-card" style={{ marginBottom: '20px', padding: '20px', borderLeft: '4px solid var(--color-primary)' }}>
          <p>For urgent assistance, you can also reach us via:</p>
          <ul style={{ listStyle: 'none', marginTop: '10px' }}>
            <li>📧 <strong>Email:</strong> info@palmmeritglobal.com</li>
            <li>💬 <strong>WhatsApp:</strong> +234 123 456 7890</li>
          </ul>
        </div>

        {showCreate ? (
          <div className="card ticket-form-container">
            <h3>Create a Ticket</h3>
            <form onSubmit={handleCreateTicket} className="ticket-form">
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Summarize your issue"
                  required
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select 
                  value={formData.priority} 
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your issue in detail"
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        ) : (
          <div className="dashboard-section">
            <h3>My Tickets</h3>
            {loading ? (
              <p>Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="text-muted">You have no active support tickets.</p>
            ) : (
              <div className="tickets-list">
                {tickets.map(ticket => (
                  <div className="ticket-card card" key={ticket.id}>
                    <div className="ticket-header">
                      <h4>{ticket.title}</h4>
                      <span className={`badge badge-${ticket.status === 'open' ? 'warning' : 'success'}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="ticket-desc">{ticket.description}</p>
                    <div className="ticket-footer">
                      <span>Priority: {ticket.priority}</span>
                      <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </>
  );
};

export default Support;
