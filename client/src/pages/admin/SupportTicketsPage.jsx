import React, { useState, useEffect } from 'react';
import { getAllAdminTickets, updateAdminTicket } from '../../services/api';

import './Admin.css';

const SupportTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data } = await getAllAdminTickets();
      setTickets(data);
    } catch (err) {
      setError('Failed to load tickets.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      setUpdating(true);
      await updateAdminTicket(ticketId, { status: newStatus });
      // Update local state
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert('Failed to update ticket status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'open': return 'badge-warning';
      case 'in-progress': return 'badge-info';
      case 'resolved': return 'badge-success';
      case 'closed': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <h2>Support Tickets</h2>
          <p className="text-muted">Manage user complaints and inquiries.</p>
        </header>

        <div className="card">
          {error && <div className="alert alert-danger">{error}</div>}
          
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center">Loading tickets...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan="6" className="text-center">No support tickets found.</td></tr>
                ) : (
                  tickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td>
                        <strong>{ticket.first_name} {ticket.last_name}</strong>
                        <br />
                        <small className="text-muted">{ticket.email}</small>
                      </td>
                      <td>{ticket.title}</td>
                      <td>
                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.description}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-secondary">{ticket.priority}</span>
                      </td>
                      <td>
                        <select 
                          className="input-field" 
                          style={{ width: '120px', padding: '5px' }}
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          disabled={updating}
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
};

export default SupportTicketsPage;
