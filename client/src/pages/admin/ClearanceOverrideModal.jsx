import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { 
  getClearanceCandidates, 
  getAdminClearance, 
  enableUserClearance, 
  reEnableClearance 
} from '../../services/api';
import { 
  FaTimes, 
  FaUnlockAlt, 
  FaRedoAlt, 
  FaSearch, 
  FaSpinner, 
  FaUser, 
  FaWallet, 
  FaCheckCircle, 
  FaInfoCircle
} from 'react-icons/fa';

const ClearanceOverrideModal = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('enable'); // 'enable' | 'reenable'
  const [candidates, setCandidates] = useState([]);
  const [clearancePlans, setClearancePlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [resetAccounts, setResetAccounts] = useState(true);

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getClearanceCandidates();
      setCandidates(res.data || []);
    } catch (err) {
      console.error('Failed to fetch clearance candidates:', err);
      toast.error('Failed to load active savings plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClearancePlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminClearance();
      setClearancePlans(res.data || []);
    } catch (err) {
      console.error('Failed to fetch clearance plans:', err);
      toast.error('Failed to load clearance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'enable') {
      fetchCandidates();
    } else {
      fetchClearancePlans();
    }
  }, [isOpen, activeTab, fetchCandidates, fetchClearancePlans]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const handleEnable = async (plan) => {
    const userName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim() || plan.email;
    const accounts = plan.number_of_accounts || 1;
    const totalFee = accounts * 3000;

    const confirmed = window.confirm(
      `Complete cycle and enable clearance for ${userName} (${plan.plan_name})?\n\n` +
      `• Accounts: ${accounts}\n` +
      `• Clearance Fee: ${formatCurrency(totalFee)} (₦3,000/account)\n` +
      `• Plan status will move to 'Pending Clearance'.`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(plan.id);
      const res = await enableUserClearance({ planId: plan.id, userId: plan.user_id });
      toast.success(res.data?.message || 'Clearance successfully enabled.');
      fetchCandidates();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error enabling clearance:', err);
      toast.error(err.response?.data?.message || 'Could not enable clearance.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReEnable = async (plan) => {
    const userName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim() || plan.email;

    const confirmed = window.confirm(
      `Re-enable savings account for ${userName} (${plan.plan_name})?\n\n` +
      `• Previous Status: ${plan.status.toUpperCase()}\n` +
      `• The savings account will be restored to normal ACTIVE status, continuing standard contributions and cycle.`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(plan.id);
      const res = await reEnableClearance({ planId: plan.id, targetStatus: 'active' });
      toast.success(res.data?.message || 'Savings account returned to normal active status.');
      fetchClearancePlans();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error re-enabling savings account:', err);
      toast.error(err.response?.data?.message || 'Could not re-enable savings account.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredCandidates = candidates.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const email = (p.email || '').toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    const planName = (p.plan_name || '').toLowerCase();
    return fullName.includes(term) || email.includes(term) || phone.includes(term) || planName.includes(term);
  });

  const filteredClearance = clearancePlans.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const email = (p.email || '').toLowerCase();
    const planName = (p.plan_name || '').toLowerCase();
    return fullName.includes(term) || email.includes(term) || planName.includes(term);
  });

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        zIndex: 1300,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '40px',
        paddingBottom: '40px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 auto',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          background: '#ffffff'
        }}
      >
        {/* Modal Header */}
        <header 
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(212, 175, 55, 0.2)',
              color: '#d4af37',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <FaUnlockAlt />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Clearance Management Controls
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Administratively complete cycles or re-open clearance for member savings plans
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <FaTimes />
          </button>
        </header>

        {/* Tabs Bar */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('enable'); setSearchTerm(''); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderBottom: activeTab === 'enable' ? '3px solid #d4af37' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'enable' ? '#1e293b' : '#64748b',
              fontWeight: activeTab === 'enable' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <FaUnlockAlt style={{ color: activeTab === 'enable' ? '#d4af37' : '#94a3b8' }} />
            Enable Clearance (Active Plans)
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('reenable'); setSearchTerm(''); }}
            style={{
              padding: '12px 18px',
              border: 'none',
              borderBottom: activeTab === 'reenable' ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'reenable' ? '#1e293b' : '#64748b',
              fontWeight: activeTab === 'reenable' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <FaRedoAlt style={{ color: activeTab === 'reenable' ? '#3b82f6' : '#94a3b8' }} />
            Re-enable Savings Account (Return to Normal)
          </button>
        </div>

        {/* Modal Controls Bar (Search + Options) */}
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }} />
              <input
                type="text"
                placeholder={activeTab === 'enable' ? "Search active member name, email, phone, or plan..." : "Search clearance member, email, or plan..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.86rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaInfoCircle color="#94a3b8" />
            {activeTab === 'enable' 
              ? 'Showing active savings plans. Enabling clearance will complete the cycle administratively and set status to Pending Clearance (₦3,000/account).'
              : 'Showing plans currently in clearance or settlement. Re-enabling restores the account to normal Active savings status.'
            }
          </div>
        </div>

        {/* Body Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
              <FaSpinner className="fa-spin" style={{ fontSize: '2rem', marginBottom: 12, color: '#3b82f6' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading plans...</p>
            </div>
          ) : activeTab === 'enable' ? (
            filteredCandidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
                <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Eligible Active Plans Found</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  {searchTerm ? `No active plans match "${searchTerm}".` : "There are currently no active plans to enable clearance for."}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredCandidates.map((plan) => {
                  const userName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim() || 'Unknown Member';
                  const accounts = plan.number_of_accounts || 1;
                  const currentAmt = parseFloat(plan.current_amount || 0);
                  const targetAmt = parseFloat(plan.target_amount || 0);
                  const fee = accounts * 3000;
                  const isProcessing = actionLoadingId === plan.id;

                  return (
                    <div 
                      key={plan.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        gap: 16,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          flexShrink: 0
                        }}>
                          <FaUser />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.92rem' }}>{userName}</strong>
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: plan.status === 'eligibility_review' ? '#fef3c7' : '#e0f2fe',
                              color: plan.status === 'eligibility_review' ? '#b45309' : '#0369a1',
                              fontWeight: 700
                            }}>
                              {plan.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                            {plan.plan_name} &bull; {accounts} account{accounts > 1 ? 's' : ''} &bull; {plan.email}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: 2, fontWeight: 600 }}>
                            Saved: {formatCurrency(currentAmt)} {targetAmt > 0 && `(Target: ${formatCurrency(targetAmt)})`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Fee Required</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b45309' }}>
                            {formatCurrency(fee)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEnable(plan)}
                          disabled={isProcessing}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: isProcessing ? '#94a3b8' : 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(212, 175, 55, 0.25)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isProcessing ? <><FaSpinner className="fa-spin" /> Enabling...</> : <><FaUnlockAlt /> Enable Clearance</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredClearance.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📋</div>
                <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Clearance Plans Found</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  {searchTerm ? `No plans match "${searchTerm}".` : "No programs currently in the clearance pipeline."}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredClearance.map((plan) => {
                  const userName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim() || plan.email;
                  const accounts = plan.number_of_accounts || 1;
                  const ac = parseInt(plan.accounts_cleared || 0, 10);
                  const isProcessing = actionLoadingId === plan.id;

                  const statusColor = plan.status === 'settled' ? '#10b981' : plan.status === 'pending_settlement' ? '#3b82f6' : '#f59e0b';
                  const statusBg = plan.status === 'settled' ? '#f0fdf4' : plan.status === 'pending_settlement' ? '#eff6ff' : '#fffbeb';

                  return (
                    <div 
                      key={plan.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        gap: 16,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: statusBg,
                          color: statusColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          flexShrink: 0
                        }}>
                          <FaWallet />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.92rem' }}>{userName}</strong>
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: statusBg,
                              color: statusColor,
                              fontWeight: 700
                            }}>
                              {plan.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                            {plan.plan_name} &bull; {accounts} account{accounts > 1 ? 's' : ''} &bull; {plan.email}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 2 }}>
                            Accounts Cleared: <strong>{ac} / {accounts}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleReEnable(plan)}
                          disabled={isProcessing}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: isProcessing ? '#94a3b8' : '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isProcessing ? <><FaSpinner className="fa-spin" /> Re-enabling...</> : <><FaRedoAlt /> Re-enable Clearance</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <footer style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              background: '#e2e8f0',
              color: '#334155',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ClearanceOverrideModal;
