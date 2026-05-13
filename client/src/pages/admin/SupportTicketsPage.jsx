import React, { useState, useEffect } from 'react';
import { getAllAdminTickets, updateAdminTicket } from '../../services/api';
import { FaTicketAlt, FaUser, FaEnvelope, FaClock, FaExclamationCircle, FaCheckCircle, FaHistory } from 'react-icons/fa';
import './Admin.css';

const SupportTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data } = await getAllAdminTickets();
      setTickets(data);
      setError('');
    } catch (err) {
      setError('Unable to load support tickets. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      setUpdatingId(ticketId);
      await updateAdminTicket(ticketId, { status: newStatus });
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert('Failed to update ticket status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'open': return 'status-pending';
      case 'in-progress': return 'status-info';
      case 'resolved': return 'status-verified';
      case 'closed': return 'pill-dark';
      default: return 'pill-dark';
    }
  };

  const getPriorityClass = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'text-danger';
      case 'medium': return 'text-warning';
      case 'low': return 'text-success';
      default: return '';
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaTicketAlt /></div>
          <div>
            <h2>Support & Assistance</h2>
            <p className="text-muted">Manage community inquiries and technical support tickets.</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={fetchTickets} className="btn-retry">Retry Load</button>
        </div>
      )}

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Loading active tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">🎟️</div>
            <h3>No Active Tickets</h3>
            <p>Great! All support inquiries have been resolved or closed.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaUser /> User</th>
                  <th>Inquiry Details</th>
                  <th>Status</th>
                  <th><FaClock /> Last Updated</th>
                  <th className="text-right">Manage Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">
                          {ticket.first_name?.[0]}{ticket.last_name?.[0]}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{ticket.first_name} {ticket.last_name}</span>
                          <span className="member-id"><FaEnvelope size={10} /> {ticket.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="ticket-content">
                        <span className={`priority-tag ${getPriorityClass(ticket.priority)}`}>
                          <FaExclamationCircle size={10} /> {ticket.priority || 'NORMAL'}
                        </span>
                        <div className="ticket-title">{ticket.title}</div>
                        <div className="ticket-excerpt">{ticket.description}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${getStatusBadgeClass(ticket.status)}`}>
                        {ticket.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="date-cell">
                      {new Date(ticket.updated_at || ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <select
                        className="status-select-refined"
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        disabled={updatingId === ticket.id}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTicketsPage;
