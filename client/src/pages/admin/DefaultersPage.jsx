import React, { useState, useEffect } from 'react';

import { getDefaulters } from '../../services/api';
import { FaUserTimes, FaExclamationCircle } from 'react-icons/fa';
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
      const { data } = await getDefaulters();
      setDefaulters(data);
    } catch (error) {
      console.error('Error fetching defaulters:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <header className="dashboard-header">
          <div>
            <h2>Defaulters List</h2>
            <p className="text-muted">Track and manage members with missed contributions.</p>
          </div>
        </header>

        <div className="dashboard-section">
          {loading ? (
            <div className="loading-state">Loading defaulters...</div>
          ) : defaulters.length === 0 ? (
            <div className="empty-state">
              <FaUserTimes size={48} color="#ccc" />
              <p>No active defaulters found. Good job!</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Plan</th>
                    <th>Missed Date</th>
                    <th>Penalty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.first_name} {d.last_name}</strong><br />
                        <small className="text-muted">{d.email}</small>
                      </td>
                      <td>{d.plan_name}</td>
                      <td>{new Date(d.missed_date).toLocaleDateString()}</td>
                      <td className="text-danger">₦{parseFloat(d.penalty_amount).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-warning">UNRESOLVED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </>
  );
};

export default DefaultersPage;
