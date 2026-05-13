import React, { useState, useEffect } from 'react';
import { getDefaulters } from '../../services/api';
import { FaUserTimes, FaExclamationTriangle, FaGavel, FaEnvelope, FaCalendarTimes, FaUser } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const DefaultersPage = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDefaulters();
  }, []);

  const fetchDefaulters = async () => {
    try {
      setLoading(true);
      const { data } = await getDefaulters();
      setDefaulters(data);
    } catch (error) {
      console.error('Error fetching defaulters:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaGavel /></div>
          <div>
            <h2>Defaulter Management</h2>
            <p className="text-muted">Monitor and resolve members with missed program contributions.</p>
          </div>
        </div>
      </header>

      <div className="admin-card table-card">
        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Fetching delinquency records...</span>
          </div>
        ) : defaulters.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">✅</div>
            <h3>No Active Defaulters</h3>
            <p>Excellent! All community members are currently up to date with their contributions.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaUser /> Member</th>
                  <th>Subscription Plan</th>
                  <th><FaCalendarTimes /> Missed Date</th>
                  <th>Penalty Amount</th>
                  <th>Resolution Status</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.map((d) => (
                  <tr key={d.id} className="table-row-hover">
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar" style={{ background: '#f59e0b' }}>
                          {d.first_name?.[0]}{d.last_name?.[0]}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{d.first_name} {d.last_name}</span>
                          <span className="member-id"><FaEnvelope size={10} /> {d.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pill pill-dark">{d.plan_name?.replace('_', ' ')}</span>
                    </td>
                    <td className="date-cell">
                      {new Date(d.missed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <div className="penalty-value">₦{parseFloat(d.penalty_amount).toLocaleString()}</div>
                    </td>
                    <td>
                      <span className="badge-status status-unverified">
                        <FaExclamationTriangle size={10} /> UNRESOLVED
                      </span>
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

export default DefaultersPage;
