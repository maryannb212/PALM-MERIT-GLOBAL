import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { getMyTransactions, payTshirtFee, getMyPlans, generateVirtualAccount, updateBvn } from '../../services/api';
import { FaEye, FaEyeSlash, FaCopy, FaUniversity, FaCheckCircle, FaSpinner, FaIdCard } from 'react-icons/fa';
import './Dashboard.css';

/* ─── BVN Input Modal ────────────────────────────────────────────────── */
const BvnModal = ({ onClose, onSuccess }) => {
  const [bvn, setBvn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{11}$/.test(bvn)) {
      setError('BVN must be exactly 11 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateBvn(bvn);
      onSuccess(bvn);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save BVN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '420px', borderRadius: '18px', overflow: 'hidden', padding: 0 }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #800020, #4a0012)',
          padding: '28px 28px 20px',
          color: '#fff',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: '16px', right: '18px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
          >
            &times;
          </button>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🪪</div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Enter Your BVN</h3>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
            Required to generate your personal Lotus Bank virtual account
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px' }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '8px' }}>
              Bank Verification Number (BVN)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={bvn}
              onChange={e => { setBvn(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="Enter your 11-digit BVN"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                border: error ? '2px solid #dc2626' : '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '1.05rem',
                letterSpacing: '2px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                fontFamily: 'monospace'
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#800020'; }}
              onBlur={e => { if (!error) e.target.style.borderColor = '#e5e7eb'; }}
            />
            {error && (
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#dc2626' }}>{error}</p>
            )}
          </div>

          {/* Info box */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '0.8rem',
            color: '#166534',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start'
          }}>
            <FaIdCard style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>Your BVN is a unique 11-digit number issued by the CBN. You can find it by dialling <strong>*565*0#</strong> on your registered phone number.</span>
          </div>

          <button
            type="submit"
            disabled={loading || bvn.length !== 11}
            style={{
              width: '100%',
              padding: '13px',
              background: bvn.length === 11 && !loading ? 'linear-gradient(135deg, #800020, #4a0012)' : '#d1d5db',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: bvn.length === 11 && !loading ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Saving BVN...</> : '✅ Save BVN & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ─── Virtual Account Card ───────────────────────────────────────────── */
const VirtualAccountSection = ({ user, onVaGenerated }) => {
  const hasVA = !!user?.virtual_account_number;
  const hasBvn = !!user?.bvn;

  const [showBvnModal, setShowBvnModal] = useState(false);
  const [bvnSaved, setBvnSaved] = useState(hasBvn);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const { data } = await generateVirtualAccount();
      if (data.virtual_account_number) {
        onVaGenerated(data);
      } else {
        setGenError(data.message || 'Could not generate virtual account. Please contact support.');
      }
    } catch (err) {
      setGenError(err.response?.data?.message || 'Failed to generate virtual account. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBvnSuccess = (savedBvn) => {
    setBvnSaved(true);
    setShowBvnModal(false);
  };

  /* ── State 1: Has virtual account — show it ── */
  if (hasVA) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2027 100%)',
        borderRadius: '18px',
        padding: '28px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,215,0,0.06)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '1.5rem' }}>🏦</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFD700' }}>Your Lotus Bank Virtual Account</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Transfer directly to this account to fund your wallet</p>
          </div>
          <span style={{ marginLeft: 'auto', background: '#16a34a', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaCheckCircle /> Active
          </span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px 20px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Name</span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '3px' }}>{user.virtual_bank_name || 'Lotus Bank'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Name</span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '3px' }}>{user.virtual_account_name}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Number</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFD700', letterSpacing: '2px', marginTop: '3px' }}>
                {user.virtual_account_number}
              </div>
            </div>
            <button
              onClick={() => handleCopy(user.virtual_account_number)}
              style={{
                background: copied ? '#16a34a' : 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.3)',
                color: copied ? '#fff' : '#FFD700',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <><FaCheckCircle /> Copied!</> : <><FaCopy /> Copy</>}
            </button>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
          ⚡ Transfers are credited to your wallet instantly after confirmation
        </p>
      </div>
    );
  }

  /* ── State 2: No VA but has BVN — show generate button ── */
  if (bvnSaved) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
        border: '1.5px solid #fcd34d',
        borderRadius: '18px',
        padding: '28px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>🏦</div>
        <h3 style={{ margin: '0 0 8px', color: '#92400e', fontSize: '1.1rem', fontWeight: 700 }}>Generate Your Virtual Account</h3>
        <p style={{ margin: '0 0 20px', color: '#78350f', fontSize: '0.85rem', lineHeight: 1.6 }}>
          Your BVN is on file. Click below to generate a dedicated Lotus Bank account number for easy wallet top-ups.
        </p>
        {genError && (
          <p style={{ marginBottom: '14px', color: '#dc2626', fontSize: '0.82rem', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>{genError}</p>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? '#d1d5db' : 'linear-gradient(135deg, #800020, #4a0012)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '13px 28px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: generating ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          {generating
            ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
            : '🏦 Generate Virtual Account'}
        </button>
      </div>
    );
  }

  /* ── State 3: No VA, no BVN — prompt BVN entry ── */
  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
        border: '1.5px dashed #cbd5e1',
        borderRadius: '18px',
        padding: '28px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>🪪</div>
        <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>Get a Virtual Account Number</h3>
        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
          Fund your wallet easily by transferring to a dedicated Lotus Bank account.<br />
          You need to provide your BVN to generate one.
        </p>
        <button
          onClick={() => setShowBvnModal(true)}
          style={{
            background: 'linear-gradient(135deg, #800020, #4a0012)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '13px 28px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🪪 Enter BVN to Continue
        </button>
      </div>

      {showBvnModal && (
        <BvnModal onClose={() => setShowBvnModal(false)} onSuccess={handleBvnSuccess} />
      )}
    </>
  );
};

/* ─── Main Wallet Component ──────────────────────────────────────────── */
const Wallet = () => {
  const { user, updateUser, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tshirtLoading, setTshirtLoading] = useState(false);
  const [hideBalances, setHideBalances] = useState(true);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await getMyPlans();
        setPlans(data || []);
      } catch (err) {
        console.error('Error fetching plans in wallet:', err);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        if (refreshProfile) await refreshProfile();
        const response = await getMyTransactions();
        setTransactions(response.data || []);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const isClearanceDue = plans.some(p =>
    ['matured', 'pending_clearance'].includes(p.status) && p.clearance_required
  );

  const handleTshirtPayment = async () => {
    if (availableBalance < 5000) {
      alert('Insufficient available balance. Please top up your wallet first.');
      return;
    }
    if (!window.confirm('Are you sure you want to pay ₦5,000 for your Incentive T-Shirt?')) return;
    setTshirtLoading(true);
    try {
      await payTshirtFee();
      updateUser({ tshirt_paid: true });
      alert('T-Shirt payment successful!');
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Payment failed');
    } finally {
      setTshirtLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const availableBalance = parseFloat(user?.available_balance || 0);
  const heldBalance = parseFloat(user?.held_balance || 0);
  const walletBalance = parseFloat(user?.walletBalance || user?.wallet_balance || 0);

  const totalCredit = transactions
    .filter(t => (t.type === 'deposit' || t.type === 'wallet_topup') && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalDebit = transactions
    .filter(t => (t.type === 'withdrawal' || t.type === 'subscription' || t.type === 'clearance' || t.type === 'membership') && t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const handleVaGenerated = (vaData) => {
    updateUser({
      virtual_account_number: vaData.virtual_account_number,
      virtual_bank_name: vaData.virtual_bank_name,
      virtual_account_name: vaData.virtual_account_name,
      virtual_provider: vaData.virtual_provider
    });
  };

  return (
    <>
      <header className="dashboard-header">
        <h2>My Wallet</h2>
      </header>

      {/* ─── Settlement Account Card ─── */}
      <div className="virtual-account-card">
        <div className="virtual-account-info">
          <h3>Settlement Account</h3>
          <p>Funds will be sent here upon withdrawal. Update your bank details anytime.</p>
          <div className="virtual-account-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <Link to="/dashboard/bank-details" className="btn btn-sm btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Manage Bank Details
            </Link>
            <button disabled className="btn btn-sm btn-warning" style={{ padding: '8px 16px', fontSize: '0.85rem', opacity: 0.6, cursor: 'not-allowed' }} title="Withdrawals are currently disabled">
              Withdraw Funds
            </button>
          </div>
        </div>
        <div className="virtual-account-balance" onClick={() => setHideBalances(!hideBalances)} style={{ cursor: 'pointer' }}>
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
            Wallet Balance
            <span style={{ fontSize: '0.85rem', color: '#ff781f' }}>({hideBalances ? 'Show' : 'Hide'})</span>
          </span>
          <span className="amount">
            {hideBalances
              ? <span style={{ fontSize: '1.4rem', letterSpacing: '2px' }}>••••••</span>
              : formatCurrency(walletBalance)}
          </span>
        </div>
      </div>

      {/* ─── Virtual Account / Fund Wallet Section ─── */}
      <VirtualAccountSection user={user} onVaGenerated={handleVaGenerated} />

      {/* ─── T-Shirt Reminder Banner ─── */}
      {!user?.tshirt_paid && isClearanceDue && (
        <div className="tshirt-banner">
          <div className="tshirt-content">
            <div className="tshirt-icon">👕</div>
            <div className="tshirt-text">
              <h4>Incentive T-Shirt Payment Required</h4>
              <p>To participate in PROGRAMMES and collect payouts, please pay your ₦5,000 T-shirt fee.</p>
            </div>
          </div>
          <button className="tshirt-btn" onClick={handleTshirtPayment} disabled={tshirtLoading}>
            {tshirtLoading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      )}

      {/* ─── Stats Row ─── */}
      <div className="stats-grid stats-grid-wallet" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <div className="stat-card wallet-balance-card" onClick={() => setHideBalances(!hideBalances)} style={{ cursor: 'pointer' }}>
          <div className="stat-icon">💰</div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            Available Balance
            <span style={{ fontSize: '0.8rem', color: '#ff781f', textDecoration: 'underline' }}>({hideBalances ? 'Show' : 'Hide'})</span>
          </h3>
          <div className="stat-value">
            {hideBalances
              ? <span style={{ fontSize: '1.5rem', letterSpacing: '3px' }}>••••••</span>
              : formatCurrency(availableBalance)}
          </div>
        </div>
        <div className="stat-card credit-card" style={{ background: '#fff3cd', cursor: 'pointer' }} onClick={() => setHideBalances(!hideBalances)}>
          <div className="stat-icon">🔒</div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            Held Balance
            <span style={{ fontSize: '0.8rem', color: '#ff781f', textDecoration: 'underline' }}>({hideBalances ? 'Show' : 'Hide'})</span>
          </h3>
          <div className="stat-value">
            {hideBalances
              ? <span style={{ fontSize: '1.5rem', letterSpacing: '3px' }}>••••••</span>
              : formatCurrency(heldBalance)}
          </div>
        </div>
      </div>

      {/* ─── Transaction History ─── */}
      <div className="transaction-history-section">
        <h3>Transaction History</h3>
        <div className="table-controls">
          <div className="filters">
            <select className="control-select"><option>All time</option></select>
            <select className="control-select"><option>All Orders</option></select>
          </div>
          <div className="search-box">
            <input type="text" placeholder="Search Order" className="control-input" />
          </div>
        </div>

        <div className="table-responsive">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="empty-table-msg">Loading transactions...</td></tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.plan_name ? `Subscription: ${tx.plan_name}` : (tx.type.charAt(0).toUpperCase() + tx.type.slice(1))}</td>
                    <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td>{formatCurrency(tx.amount)}</td>
                    <td>
                      <span className={`badge ${tx.type === 'deposit' || tx.type === 'wallet_topup' ? 'badge-success' : 'badge-warning'}`} style={{
                        color: (tx.type === 'deposit' || tx.type === 'wallet_topup') ? '#155724' : '#856404',
                        background: (tx.type === 'deposit' || tx.type === 'wallet_topup') ? '#d4edda' : '#fff3cd'
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: tx.status === 'completed' ? '#d4edda' : (tx.status === 'failed' ? '#f8d7da' : (tx.status === 'cancelled' ? '#e9ecef' : '#fff3cd')),
                        color: tx.status === 'completed' ? '#155724' : (tx.status === 'failed' ? '#721c24' : (tx.status === 'cancelled' ? '#6c757d' : '#856404'))
                      }}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="empty-table-msg">No data available in table</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <select className="control-select pagination-select">
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default Wallet;
