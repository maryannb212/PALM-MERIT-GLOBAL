import React, { useState, useEffect } from 'react';
import { 
  FaTimes, FaUser, FaWallet, FaRegAddressCard, FaPiggyBank, 
  FaUniversity, FaFileImage, FaExternalLinkAlt, FaInfoCircle, FaShieldAlt,
  FaExclamationCircle, FaCircle, FaUserFriends, FaLink, FaTree, FaCopy
} from 'react-icons/fa';
import { getAdminUserById } from '../../services/api';
import { adminFastForwardClearance } from '../../services/api';
import './Admin.css';

const MemberDetailsModal = ({ isOpen, onClose, userId }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // profile, kyc, financial
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserDetails();
    } else {
      setDetails(null);
      setError('');
    }
  }, [isOpen, userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAdminUserById(userId);
      setDetails(data);
    } catch (err) {
      console.error('Error fetching member details:', err);
      setError('Could not establish database sync. Please verify connection credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content admin-card-premium" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '25px', position: 'relative', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', transition: '0.2s' }}
          onMouseEnter={(e) => e.target.style.color = '#d4af37'}
          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
        >
          <FaTimes />
        </button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '15px' }}>
            <div className="spinner-small" style={{ borderColor: '#800020', borderTopColor: '#d4af37' }}></div>
            <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem' }}>Retrieving live database records...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center', gap: '15px' }}>
            <FaShieldAlt size={40} style={{ color: '#ef4444' }} />
            <h3 style={{ color: '#ff9999' }}>Database Sync Failed</h3>
            <p style={{ color: '#94a3b8', maxWidth: '400px', fontSize: '0.9rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={fetchUserDetails} style={{ marginTop: '10px' }}>Retry Sync</button>
          </div>
        ) : !details ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No member record selected.</div>
        ) : (
          <div>
            {/* Modal Header Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ width: '65px', height: '65px', borderRadius: '50%', background: 'linear-gradient(135deg, #800020 0%, #d4af37 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white', boxShadow: '0 4px 15px rgba(128, 0, 32, 0.4)' }}>
                {details.first_name?.[0]}{details.last_name?.[0]}
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h2 style={{ color: '#d4af37', margin: 0, fontSize: '1.6rem', fontWeight: 'bold' }}>{details.first_name} {details.last_name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>UUID: {details.id}</span>
                  <span className={`badge-pill ${details.role === 'admin' ? 'pill-burgundy' : 'pill-dark'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                    {details.role.toUpperCase()}
                  </span>
                  <span className={`badge-status ${details.kyc_status === 'verified' ? 'status-verified' : details.kyc_status === 'pending' ? 'status-pending' : 'status-unverified'}`} style={{ fontSize: '0.75rem' }}>
                    KYC: {details.kyc_status?.toUpperCase() || 'UNVERIFIED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Navigation Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('profile')}
                style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#d4af37' : '#64748b', fontWeight: 'bold', padding: '8px 16px', borderBottom: activeTab === 'profile' ? '2px solid #d4af37' : 'none', cursor: 'pointer', transition: '0.2s', fontSize: '0.9rem' }}
              >
                <FaUser style={{ marginRight: '6px' }} /> Account & KYC Details
              </button>
              <button 
                onClick={() => setActiveTab('financial')}
                style={{ background: 'none', border: 'none', color: activeTab === 'financial' ? '#d4af37' : '#64748b', fontWeight: 'bold', padding: '8px 16px', borderBottom: activeTab === 'financial' ? '2px solid #d4af37' : 'none', cursor: 'pointer', transition: '0.2s', fontSize: '0.9rem' }}
              >
                <FaWallet style={{ marginRight: '6px' }} /> Financial Ledger & Subscriptions
              </button>
              <button 
                onClick={() => setActiveTab('referral')}
                style={{ background: 'none', border: 'none', color: activeTab === 'referral' ? '#d4af37' : '#64748b', fontWeight: 'bold', padding: '8px 16px', borderBottom: activeTab === 'referral' ? '2px solid #d4af37' : 'none', cursor: 'pointer', transition: '0.2s', fontSize: '0.9rem' }}
              >
                <FaUserFriends style={{ marginRight: '6px' }} /> Referral Network
              </button>
            </div>

            {/* TAB CONTENT: PROFILE & KYC */}
            {activeTab === 'profile' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px' }}>
                {/* Account Settings & Registration */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaUser size={16} /> Account Registration
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Full Name:</span>
                      <strong style={{ color: 'white' }}>{details.first_name} {details.last_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Email:</span>
                      <strong style={{ color: 'white' }}>{details.email || 'No email associated'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Phone Number:</span>
                      <strong style={{ color: 'white' }}>{details.phone || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Membership Status:</span>
                      <strong style={{ color: details.has_paid_membership ? '#10b981' : '#f59e0b' }}>
                        {details.has_paid_membership ? 'PREMIUM (PAID)' : 'GUEST (UNPAID)'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Registered On:</span>
                      <strong style={{ color: 'white' }}>{formatDate(details.created_at)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Operational Status:</span>
                      <strong style={{ color: details.status === 'active' ? '#10b981' : '#ef4444' }}>
                        {details.status?.toUpperCase() || 'ACTIVE'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* KYC Submission Data */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaRegAddressCard size={16} /> KYC Verification Record
                  </h3>
                  {details.kyc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Legal Middle Name:</span>
                        <strong style={{ color: 'white' }}>{details.kyc.middle_name || 'None'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Date of Birth:</span>
                        <strong style={{ color: 'white' }}>{formatDate(details.kyc.dob)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Gender:</span>
                        <strong style={{ color: 'white' }}>{details.kyc.gender || 'N/A'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>BVN Verification:</span>
                        <strong style={{ color: 'white', fontFamily: 'monospace' }}>{details.kyc.bvn || 'Not submitted'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>ID Document Type:</span>
                        <strong style={{ color: 'white' }}>{details.kyc.id_type || 'N/A'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>ID Number:</span>
                        <strong style={{ color: 'white' }}>{details.kyc.id_number || 'N/A'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Residential Address:</span>
                        <strong style={{ color: 'white', textAlign: 'right', maxWidth: '60%' }}>{details.kyc.address || 'N/A'}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0', color: '#64748b', textAlign: 'center', gap: '8px' }}>
                      <FaInfoCircle size={20} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>No KYC application has been submitted by this member yet.</p>
                    </div>
                  )}
                </div>

                {/* KYC Uploaded Media Preview */}
                {details.kyc && (
                  <div style={{ gridColumn: '1 / -1', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                      <FaFileImage size={16} /> Identity Verification Files
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {details.kyc.document_url && (
                        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold' }}>ID Document (Front)</span>
                          <div style={{ width: '100%', height: '120px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }} onClick={() => setImagePreview(details.kyc.document_url)}>
                            <img src={details.kyc.document_url} alt="ID Document Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                            <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'white' }}>
                              Preview <FaExternalLinkAlt size={8} />
                            </div>
                          </div>
                        </div>
                      )}
                      {details.kyc.document_back_url && (
                        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold' }}>ID Document (Back)</span>
                          <div style={{ width: '100%', height: '120px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }} onClick={() => setImagePreview(details.kyc.document_back_url)}>
                            <img src={details.kyc.document_back_url} alt="ID Document Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'white' }}>
                              Preview <FaExternalLinkAlt size={8} />
                            </div>
                          </div>
                        </div>
                      )}
                      {details.kyc.selfie_url && (
                        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold' }}>Verification Selfie</span>
                          <div style={{ width: '100%', height: '120px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }} onClick={() => setImagePreview(details.kyc.selfie_url)}>
                            <img src={details.kyc.selfie_url} alt="KYC Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'white' }}>
                              Preview <FaExternalLinkAlt size={8} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: FINANCIALS & SUB-LEDGER */}
            {activeTab === 'financial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                
                {/* Balance Cards & Banks Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  {/* Account Ledgers Card */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                      <FaWallet size={16} /> Wallet Ledger
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Total Wallet Balance:</span>
                        <strong style={{ color: '#e2e8f0' }}>{formatCurrency(details.wallet_balance)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Available Balance:</span>
                        <strong style={{ color: '#10b981' }}>{formatCurrency(details.available_balance)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Held / Locked Balance:</span>
                        <strong style={{ color: '#f59e0b' }}>{formatCurrency(details.held_balance)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Registered Bank Accounts Card */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                      <FaUniversity size={16} /> Settlement Bank Info
                    </h3>
                    {details.bank_accounts && details.bank_accounts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                        {details.bank_accounts.map((acc, idx) => (
                          <div key={idx} style={{ borderBottom: idx === details.bank_accounts.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', paddingBottom: idx === details.bank_accounts.length - 1 ? 0 : '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#64748b' }}>Bank Name:</span>
                              <strong style={{ color: '#e2e8f0' }}>{acc.bank_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#64748b' }}>Account Number:</span>
                              <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{acc.account_number}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Account Name:</span>
                              <strong style={{ color: '#e2e8f0' }}>{acc.account_name}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '15px 0', color: '#64748b', textAlign: 'center', gap: '6px' }}>
                        <FaInfoCircle size={18} />
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>No settlement bank account details have been configured.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Savings Subscriptions Details */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaPiggyBank size={16} /> Plan Subscriptions ({details.savings_plans?.length || 0})
                  </h3>
                  {details.savings_plans && details.savings_plans.length > 0 ? (
                    <div className="table-responsive">
                      <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Programme Name</th>
                            <th>Starting Date</th>
                            <th className="text-right">Accounts</th>
                            <th className="text-right">Current Savings</th>
                            <th className="text-right">Target Amount</th>
                            <th>Maturity</th>
                            <th className="text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.savings_plans.map((plan) => (
                            <tr key={plan.id} style={{ background: 'rgba(255,255,255,0.01)' }}>
                              <td><strong style={{ color: '#d4af37' }}>{plan.plan_name}</strong></td>
                              <td>{formatDate(plan.start_date)}</td>
                              <td className="text-right">{plan.number_of_accounts}</td>
                              <td className="text-right" style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(plan.current_amount)}</td>
                              <td className="text-right" style={{ color: '#e2e8f0' }}>{formatCurrency(plan.target_amount)}</td>
                              <td>{formatDate(plan.maturity_date || plan.end_date)}</td>
                              <td className="text-right">
                                <span className={`badge-status ${plan.computed_status === 'completed' ? 'status-verified' : (plan.status === 'active' ? 'status-verified' : 'status-unverified')}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {(plan.computed_status || plan.status || '').toUpperCase()}
                                </span>
                                {plan.cycleCompleted && plan.completionMessage && (
                                  <div style={{ marginTop: '8px', background: '#dcfce7', color: '#064e3b', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    {plan.completionMessage}
                                  </div>
                                )}
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button className="btn-filter" onClick={async () => {
                                    const input = window.prompt('Enter number of days to fast-forward clearance (positive integer) or an exact date (YYYY-MM-DD):');
                                    if (!input) return;
                                    const days = parseInt(input, 10);
                                    let payload = { planId: plan.id };
                                    if (!isNaN(days) && String(days) === input.trim()) {
                                      payload.days = days;
                                    } else {
                                      // assume date
                                      payload.newDate = input.trim();
                                    }
                                    try {
                                      await adminFastForwardClearance(details.id, payload);
                                      alert('Clearance date updated. Refreshing details.');
                                      await fetchUserDetails();
                                    } catch (err) {
                                      console.error('Fast-forward failed', err);
                                      alert('Failed to update clearance date. See console for details.');
                                    }
                                  }}>Fast-forward Clearance</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0', color: '#64748b', textAlign: 'center', gap: '10px' }}>
                      <FaPiggyBank size={24} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>This member has not subscribed to any cooperative savings programmes.</p>
                    </div>
                  )}
                </div>

                {/* Defaults / Penalty Section */}
                <div style={{ background: details.default_count > 0 ? 'rgba(220, 38, 38, 0.08)' : 'rgba(255, 255, 255, 0.02)', border: `1px solid ${details.default_count > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`, borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: details.default_count > 0 ? '#ef4444' : '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaExclamationCircle size={16} /> Defaults & Penalties
                  </h3>
                  <div style={{ display: 'flex', gap: '15px', marginBottom: details.defaults?.length ? '15px' : '0', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 18px', borderRadius: '8px', flex: 1, minWidth: '140px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Status</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <FaCircle size={8} color={details.default_count > 0 ? '#dc2626' : '#10b981'} />
                        <strong style={{ color: details.default_count > 0 ? '#ef4444' : '#10b981', fontSize: '0.95rem' }}>
                          {details.savings_status === 'defaulted' ? 'DEFAULTED' : 'ACTIVE'}
                        </strong>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 18px', borderRadius: '8px', flex: 1, minWidth: '140px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Default Count</span>
                      <strong style={{ color: '#e2e8f0', fontSize: '1.1rem', display: 'block', marginTop: '4px' }}>{details.default_count || 0}</strong>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 18px', borderRadius: '8px', flex: 1, minWidth: '140px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Outstanding Balance</span>
                      <strong style={{ color: '#ef4444', fontSize: '1.1rem', display: 'block', marginTop: '4px' }}>{formatCurrency(details.outstanding_default)}</strong>
                    </div>
                  </div>
                  {details.defaults && details.defaults.length > 0 && (
                    <div className="table-responsive">
                      <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Missed Date</th>
                            <th className="text-right">Penalty Amount</th>
                            <th className="text-right">Resolved</th>
                            <th className="text-right">Resolved At</th>
                            <th className="text-right">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.defaults.map((d) => (
                            <tr key={d.id} style={{ background: 'rgba(255,255,255,0.01)' }}>
                              <td>{formatDate(d.missed_date)}</td>
                              <td className="text-right" style={{ color: '#ef4444', fontWeight: 'bold' }}>{formatCurrency(d.penalty_amount)}</td>
                              <td className="text-right">
                                <span className={`badge-status ${d.resolved ? 'status-verified' : 'status-unverified'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {d.resolved ? 'YES' : 'NO'}
                                </span>
                              </td>
                              <td className="text-right">{d.resolved ? formatDate(d.resolved_at) : '—'}</td>
                              <td className="text-right">{formatDate(d.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: REFERRAL NETWORK */}
            {activeTab === 'referral' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Referrer Info Card */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaLink size={16} /> Referral Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Referral Code</span>
                      <div style={{ color: 'white', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '4px', fontSize: '0.9rem' }}>
                        {details.referral_code || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Referred By</span>
                      <div style={{ color: 'white', fontWeight: 600, marginTop: '4px' }}>
                        {details.referred_by_user ? (
                          <span>{details.referred_by_user.first_name} {details.referred_by_user.last_name} ({details.referred_by_user.email})</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>— Direct Signup</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Unlock Date</span>
                      <div style={{ color: 'white', fontWeight: 600, marginTop: '4px' }}>
                        {details.referral_unlock_date ? formatDate(details.referral_unlock_date) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Expiry Date</span>
                      <div style={{ color: 'white', fontWeight: 600, marginTop: '4px' }}>
                        {details.referral_expiry_date ? formatDate(details.referral_expiry_date) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Downlines Card */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ color: '#d4af37', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                    <FaUserFriends size={16} /> Downlines ({details.downline_count || 0})
                  </h3>
                  {details.downlines && details.downlines.length > 0 ? (
                    <div className="table-responsive">
                      <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.downlines.map((down) => (
                            <tr key={down.id} style={{ background: 'rgba(255,255,255,0.01)' }}>
                              <td><strong style={{ color: 'white' }}>{down.first_name} {down.last_name}</strong></td>
                              <td style={{ color: '#94a3b8' }}>{down.email || 'N/A'}</td>
                              <td style={{ color: '#94a3b8' }}>{down.phone || 'N/A'}</td>
                              <td>
                                <span className={`badge-status ${down.status === 'active' ? 'status-verified' : 'status-unverified'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {down.status?.toUpperCase() || 'ACTIVE'}
                                </span>
                              </td>
                              <td style={{ color: '#94a3b8' }}>{formatDate(down.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0', color: '#64748b', textAlign: 'center', gap: '10px' }}>
                      <FaUserFriends size={24} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>This member has not referred any downlines yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Overlay Modal */}
      {imagePreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.9)', zIndex: 1300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' }} onClick={() => setImagePreview(null)}>
          <button 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem' }}
            onClick={() => setImagePreview(null)}
          >
            <FaTimes />
          </button>
          <img src={imagePreview} alt="Enlarged Document Preview" style={{ maxWidth: '90%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', border: '2px solid rgba(212,175,55,0.5)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }} />
          <div style={{ marginTop: '15px', color: '#94a3b8', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '6px 15px', borderRadius: '20px' }}>
            Click anywhere outside the image to dismiss preview
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDetailsModal;
