import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaSearch, FaFilter, FaExclamationTriangle, FaUserFriends, 
  FaClock, FaShieldAlt, FaChevronDown, FaChevronUp, FaUserCheck, FaBan
} from 'react-icons/fa';
import './Admin.css';

const AdminReferrals = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [error, setError] = useState('');

  // Fetch all referral details
  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin/referrals`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (err) {
        console.error('Error fetching admin referrals:', err);
        setError('Failed to load administrative referral details.');
      } finally {
        setLoading(false);
      }
    };
    fetchReferralStats();
  }, []);

  // Filter & Search Logic
  const filteredUsers = data.filter(user => {
    const nameMatch = `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (user.referralCode && user.referralCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      user.phone.includes(searchTerm);
    const suspiciousMatch = filterSuspicious ? user.isSuspicious : true;
    return nameMatch && suspiciousMatch;
  });

  const toggleExpandUser = (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
    }
  };

  // Aggregated Stats
  const totalUnlocks = data.filter(u => u.referralUnlockDate && new Date(u.referralUnlockDate) <= new Date()).length;
  const totalSuspicious = data.filter(u => u.isSuspicious).length;
  const totalReferrals = data.reduce((sum, u) => sum + u.downlinesCount, 0);

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Analyzing referral networks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header mb-4">
        <div>
          <h2>Referral Oversight & Auditing</h2>
          <p className="subtitle">Monitor invitation chains, prevent self-referral abuse, and audit payout eligibility</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Aggregate Cards */}
      <div className="admin-stats-grid mb-4">
        <div className="admin-stat-card">
          <div className="stat-icon"><FaUserFriends /></div>
          <div className="stat-info">
            <h3>{totalReferrals}</h3>
            <span>Total Downlines Invited</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon yellow"><FaClock /></div>
          <div className="stat-info">
            <h3>{totalUnlocks}</h3>
            <span>Unlocked Invitation Links</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon red"><FaExclamationTriangle /></div>
          <div className="stat-info text-danger">
            <h3>{totalSuspicious}</h3>
            <span>Suspicious Self-Referrals</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-controls mb-4">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, referral code, or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          className={`btn-filter ${filterSuspicious ? 'active' : ''}`}
          onClick={() => setFilterSuspicious(!filterSuspicious)}
        >
          <FaFilter /> {filterSuspicious ? 'Showing Suspicious Only' : 'Filter Suspicious'}
        </button>
      </div>

      {/* Main Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Member</th>
                <th>Code</th>
                <th>Unlock Date</th>
                <th>Invites Count</th>
                <th>Qualified (Min 2)</th>
                <th>Anti-Abuse Flag</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">No referrers found matching your search.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isExpanded = expandedUser === user.id;
                  const isUnlocked = user.referralUnlockDate && new Date(user.referralUnlockDate) <= new Date();

                  return (
                    <React.Fragment key={user.id}>
                      <tr className={`clickable-row ${user.isSuspicious ? 'suspicious-row-alert' : ''}`} onClick={() => toggleExpandUser(user.id)}>
                        <td onClick={(e) => { e.stopPropagation(); toggleExpandUser(user.id); }}>
                          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </td>
                        <td>
                          <div className="member-meta">
                            <strong>{user.firstName} {user.lastName}</strong>
                            <span className="member-sub">{user.phone} | {user.email || 'No email'}</span>
                          </div>
                        </td>
                        <td>
                          <code className="referral-code-badge">{user.referralCode || 'N/A'}</code>
                        </td>
                        <td>
                          {isUnlocked ? (
                            <span className="ref-date unlocked">Active (Unlocked)</span>
                          ) : (
                            <span className="ref-date locked" title="Locked invitation link">
                              Locked till {new Date(user.referralUnlockDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="font-weight-bold">{user.downlinesCount}</td>
                        <td>
                          {user.isEligible ? (
                            <span className="badge-qualified success"><FaUserCheck /> Eligible (x2)</span>
                          ) : (
                            <span className="badge-qualified standard">Standard (x1)</span>
                          )}
                        </td>
                        <td>
                          {user.isSuspicious ? (
                            <span className="badge-flag alert-danger" title="Duplicate bank details detected with downlines">
                              <FaExclamationTriangle /> Suspected Self-Referral
                            </span>
                          ) : (
                            <span className="badge-flag safe">Verified Clean</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Row Details */}
                      {isExpanded && (
                        <tr className="expanded-details-row">
                          <td colSpan="7">
                            <div className="downlines-expanded-panel">
                              <h4>Referred Downlines Details</h4>
                              {user.downlines.length === 0 ? (
                                <p className="text-muted text-center py-2">No downline members registered under this link.</p>
                              ) : (
                                <div className="expanded-table-container">
                                  <table className="expanded-table">
                                    <thead>
                                      <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Active Plans Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {user.downlines.map((down) => (
                                        <tr key={down.id}>
                                          <td>{down.firstName} {down.lastName}</td>
                                          <td>{down.email || 'N/A'}</td>
                                          <td>
                                            {down.referralStatus === 'qualified' && (
                                              <span className="ref-badge qualified">Qualified savings downline</span>
                                            )}
                                            {down.referralStatus === 'disqualified' && (
                                              <span className="ref-badge disqualified">Non-Referral (Golden Basket Only or Suspended)</span>
                                            )}
                                            {down.referralStatus === 'pending' && (
                                              <span className="ref-badge pending">Plan initiated, pending deposits</span>
                                            )}
                                            {down.referralStatus === 'inactive' && (
                                              <span className="ref-badge inactive">Inactive (No Savings Subscriptions)</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReferrals;
