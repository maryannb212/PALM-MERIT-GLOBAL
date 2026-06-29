import React, { useState, useEffect, useMemo } from 'react';
import { getDuePayments } from '../../services/api';
import { FaMoneyBillWave, FaExclamationTriangle, FaCheckCircle, FaEnvelope, FaCalendarAlt, FaUser, FaSearch, FaSync, FaTimes, FaClock, FaPiggyBank, FaWallet, FaEye, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const PLAN_LABELS = {
  'CREST': 'Crest Programme',
  'SILVER': 'Silver Programme',
  'GOLDEN_BASKET': 'Golden Basket',
  'ISUSU': 'Isusu Daily'
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Up-to-Date' },
  { value: 'never_paid', label: 'Never Paid' }
];

const PAGE_SIZE = 20;

const DuePaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDuePayments();
  }, []);

  const fetchDuePayments = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await getDuePayments();
      setPayments(data);
    } catch (err) {
      setError('Failed to fetch due payments data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = payments;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.plan_name?.toLowerCase().includes(q)
      );
    }

    switch (statusFilter) {
      case 'due':
        result = result.filter(p => p.is_due && (p.days_since_last_payment === null || p.days_since_last_payment < 14));
        break;
      case 'overdue':
        result = result.filter(p => p.is_due && p.days_since_last_payment >= 14);
        break;
      case 'paid':
        result = result.filter(p => !p.is_due && !p.has_never_paid);
        break;
      case 'never_paid':
        result = result.filter(p => p.has_never_paid);
        break;
      default:
        break;
    }

    return result;
  }, [payments, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const dueCount = payments.filter(p => p.is_due && (p.days_since_last_payment === null || p.days_since_last_payment < 14)).length;
  const overdueCount = payments.filter(p => p.is_due && p.days_since_last_payment >= 14).length;
  const neverPaidCount = payments.filter(p => p.has_never_paid).length;
  const upToDateCount = payments.length - dueCount - overdueCount - neverPaidCount;

  const getDueBadge = (item) => {
    if (item.is_due) {
      if (item.days_since_last_payment >= 14) {
        return <span className="badge-status" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}><FaExclamationTriangle size={10} /> OVERDUE</span>;
      }
      return <span className="badge-status" style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}><FaClock size={10} /> DUE</span>;
    }
    if (item.has_never_paid) {
      return <span className="badge-pill pill-dark" style={{ fontSize: '0.7rem' }}>NOT STARTED</span>;
    }
    return <span className="badge-status status-verified"><FaCheckCircle size={10} /> PAID</span>;
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaMoneyBillWave /></div>
          <div>
            <h2>Payment Due Monitor</h2>
            <p className="text-muted">Track members whose contributions are mature for payment across all plans.</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="notification-alert alert-error">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={fetchDuePayments} className="btn-inline-retry">Retry</button>
        </div>
      )}

      {/* ─── Stats Cards ─── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
        <div className="stat-card" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div className="stat-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><FaMoneyBillWave /></div>
          <h3 style={{ color: '#9a3412', fontSize: '0.8rem' }}>Total Active Plans</h3>
          <div className="stat-count" style={{ color: '#ea580c', fontWeight: 700 }}>{payments.length}</div>
        </div>
        <div className="stat-card" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}><FaExclamationTriangle /></div>
          <h3 style={{ color: '#991b1b', fontSize: '0.8rem' }}>Overdue</h3>
          <div className="stat-count" style={{ color: '#dc2626', fontWeight: 700 }}>{overdueCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div className="stat-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><FaClock /></div>
          <h3 style={{ color: '#9a3412', fontSize: '0.8rem' }}>Due</h3>
          <div className="stat-count" style={{ color: '#ea580c', fontWeight: 700 }}>{dueCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><FaUser /></div>
          <h3 style={{ color: '#1e40af', fontSize: '0.8rem' }}>Never Paid</h3>
          <div className="stat-count" style={{ color: '#2563eb', fontWeight: 700 }}>{neverPaidCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><FaPiggyBank /></div>
          <h3 style={{ color: '#166534', fontSize: '0.8rem' }}>Up-to-Date</h3>
          <div className="stat-count" style={{ color: '#16a34a', fontWeight: 700 }}>{upToDateCount}</div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="admin-card table-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Active Plans — Payment Status</h4>
            <span style={{ background: '#e2e8f0', padding: '2px 10px', borderRadius: 20, fontSize: '0.8rem', color: '#475569' }}>{filtered.length} records</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer'
              }}
            >
              {FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
              <input
                type="text"
                placeholder="Search member or plan..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ padding: '8px 12px 8px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', width: 220, outline: 'none' }}
              />
            </div>
            <button className="btn btn-sm" onClick={fetchDuePayments} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <FaSync />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="table-loader">
            <div className="spinner-small"></div>
            <span>Analyzing payment schedules...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📋</div>
            <h3>No Active Plans</h3>
            <p>There are no active savings plans in the system.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">🔍</div>
            <h3>No Results</h3>
            <p>No records match your current filters.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th><FaUser /> Member</th>
                    <th><FaPiggyBank /> Plan</th>
                    <th>Installment</th>
                    <th>Accounts</th>
                    <th>Progress</th>
                    <th><FaCalendarAlt /> Last Payment</th>
                    <th>Days Overdue</th>
                    <th><FaWallet /> Wallet</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={`${p.plan_id}`} className="table-row-hover" style={p.is_due ? { background: '#fffbf5' } : {}}>
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar" style={{ background: p.is_due ? '#ea580c' : '#10b981' }}>
                            {p.first_name?.[0]}{p.last_name?.[0]}
                          </div>
                          <div className="member-info">
                            <span className="member-name">{p.first_name} {p.last_name}</span>
                            <span className="member-id"><FaEnvelope size={10} /> {p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge-pill pill-dark" style={{ fontSize: '0.75rem' }}>
                          {PLAN_LABELS[p.plan_name] || p.plan_name}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        ₦{p.expected_installment.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {p.number_of_accounts}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            ₦{p.total_paid.toLocaleString()} / ₦{p.target_amount.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: p.missed_contributions > 0 ? '#dc2626' : '#16a34a' }}>
                            {p.actual_contributions} of {p.expected_contributions} installments
                            {p.missed_contributions > 0 && (
                              <span style={{ color: '#dc2626', marginLeft: 4 }}>
                                ({p.missed_contributions} missed)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="date-cell">
                        {p.last_payment_date ? (
                          new Date(p.last_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Never</span>
                        )}
                      </td>
                      <td>
                        {p.days_since_last_payment !== null ? (
                          <span style={{
                            fontWeight: 600,
                            color: p.is_due ? (p.days_since_last_payment >= 14 ? '#dc2626' : '#ea580c') : '#16a34a'
                          }}>
                            {p.days_since_last_payment}d
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        ₦{p.available_balance.toLocaleString()}
                      </td>
                      <td>
                        {getDueBadge(p)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination ─── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 20px', borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap', gap: 8
            }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage <= 1}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                    background: safePage <= 1 ? '#f1f5f9' : '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    color: safePage <= 1 ? '#94a3b8' : '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem'
                  }}
                >
                  <FaChevronLeft size={10} /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                          background: p === safePage ? '#800020' : '#fff',
                          color: p === safePage ? '#fff' : '#475569',
                          cursor: 'pointer', fontWeight: p === safePage ? 700 : 400, fontSize: '0.85rem'
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage >= totalPages}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                    background: safePage >= totalPages ? '#f1f5f9' : '#fff', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    color: safePage >= totalPages ? '#94a3b8' : '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem'
                  }}
                >
                  Next <FaChevronRight size={10} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DuePaymentsPage;