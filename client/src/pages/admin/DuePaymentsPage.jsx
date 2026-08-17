import React, { useState, useEffect, useMemo } from 'react';
import { getDuePayments } from '../../services/api';
import './Admin.css';

const PLAN_COLORS = {
  'CREST': '#800020',
  'SILVER': '#6b7280',
  'GOLDEN_BASKET': '#d97706',
  'ISUSU': '#0891b2'
};

const PLAN_DURATIONS = {
  'CREST': 84,
  'SILVER': 350,
  'GOLDEN_BASKET': 350,
  'ISUSU': 30,
};

const PLAN_AMOUNTS = {
  'CREST': 4000,
  'SILVER': 1500,
  'GOLDEN_BASKET': 2000,
  'ISUSU': 500,
};

const DuePaymentsPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetchDuePayments();
  }, []);

  const fetchDuePayments = async () => {
    try {
      setLoading(true);
      const { data: res } = await getDuePayments();
      if (Array.isArray(res) && res.length > 0 && !res[0].plans) {
        setData(groupFlatData(res));
      } else {
        setData(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const groupFlatData = (flat) => {
    const userMap = {};
    const watDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    for (const entry of flat) {
      const uid = entry.user_id;
      if (!userMap[uid]) {
        userMap[uid] = { user_id: uid, first_name: entry.first_name, last_name: entry.last_name, email: entry.email, plans: [], matured_count: 0, default_count: 0 };
      }
      const numAccounts = entry.number_of_accounts || 1;
      const perAccountAmount = PLAN_AMOUNTS[entry.plan_name] || Math.round(entry.expected_installment / numAccounts);
      const durationDays = PLAN_DURATIONS[entry.plan_name] || 350;
      const startDate = new Date(entry.start_date);
      const daysSinceStart = Math.floor((watDate - startDate) / (1000 * 60 * 60 * 24));
      const isMatured = daysSinceStart >= durationDays;
      const currentAmount = parseFloat(entry.current_amount || 0);
      const targetAmount = parseFloat(entry.target_amount || 0);
      const progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
      userMap[uid].plans.push({
        plan_id: entry.plan_id,
        plan_name: entry.plan_name,
        plan_status: entry.plan_status,
        number_of_accounts: numAccounts,
        per_account_amount: perAccountAmount,
        expected_installment: entry.expected_installment,
        start_date: entry.start_date,
        maturity_date: entry.maturity_date,
        preferred_day: entry.preferred_day,
        last_payment_date: entry.last_payment_date,
        current_amount: currentAmount,
        target_amount: targetAmount,
        progress_pct: progressPct,
        defaults: [],
        days_since_start: daysSinceStart,
        duration_days: durationDays,
        is_matured: isMatured,
      });
      if (isMatured) userMap[uid].matured_count++;
    }

    return Object.values(userMap).sort((a, b) => {
      if (b.matured_count !== a.matured_count) return b.matured_count - a.matured_count;
      return a.first_name.localeCompare(b.first_name);
    });
  };

  const filtered = useMemo(() => {
    let result = Array.isArray(data) ? data : [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.plans?.some(p => p.plan_name?.toLowerCase().includes(q))
      );
    }
    if (filter === 'matured') result = result.filter(u => u.matured_count > 0);
    else if (filter === 'defaults') result = result.filter(u => u.default_count > 0);
    return result;
  }, [data, search, filter]);

  const toggleExpand = (userId) => {
    setExpanded(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const formatShort = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const safeData = Array.isArray(data) ? data : [];
  const totalMatured = safeData.reduce((s, u) => s + (u.matured_count || 0), 0);
  const totalDefaults = safeData.reduce((s, u) => s + (u.default_count || 0), 0);

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div>
            <h2>Plan Clearance</h2>
            <p className="text-muted">Monitor plan cycle progress, maturity, and defaults across all members.</p>
          </div>
        </div>
      </header>

      <div className="admin-card table-card">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h4 style={{ margin: 0 }}>Members</h4>
            {totalMatured > 0 && (
              <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                {totalMatured} matured
              </span>
            )}
            {totalDefaults > 0 && (
              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600, border: '1px solid #fecaca' }}>
                {totalDefaults} defaults
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
              <option value="all">All</option>
              <option value="matured">Matured</option>
              <option value="defaults">Has Defaults</option>
            </select>
            <input type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', width: 200 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="table-loader"><div className="spinner-small"></div><span>Loading...</span></div>
        ) : filtered.length === 0 ? (
          <div className="table-empty"><h3>No Results</h3></div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Member</th>
                  <th>Plans</th>
                  <th>Total Accts</th>
                  <th>Matured</th>
                  <th>Defaults</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <React.Fragment key={u.user_id}>
                    <tr
                      onClick={() => toggleExpand(u.user_id)}
                      style={{
                        cursor: 'pointer', background: u.matured_count > 0 ? '#f0fdf4' : 'transparent',
                        borderBottom: expanded[u.user_id] ? 'none' : undefined
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ textAlign: 'center' }}>
                        {expanded[u.user_id] ? '▼' : '▶'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{(u.plans || []).length}</td>
                      <td style={{ textAlign: 'center' }}>
                        {(u.plans || []).reduce((s, p) => s + (p.number_of_accounts || 0), 0)}
                      </td>
                      <td style={{ textAlign: 'center', color: u.matured_count > 0 ? '#16a34a' : 'inherit', fontWeight: 600 }}>
                        {u.matured_count || '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: u.default_count > 0 ? '#dc2626' : 'inherit', fontWeight: 600 }}>
                        {u.default_count || '—'}
                      </td>
                      <td>
                        {u.matured_count > 0 ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                            fontSize: '0.75rem', fontWeight: 700,
                            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0'
                          }}>MATURED</span>
                        ) : (
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                            fontSize: '0.75rem', fontWeight: 600,
                            background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                          }}>Active</span>
                        )}
                      </td>
                    </tr>

                    {expanded[u.user_id] && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: '#f8fafc' }}>
                          <div style={{ overflowX: 'auto' }}>
                            <table className="plan-detail-table">
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ textAlign: 'left' }}>Plan</th>
                                  <th style={{ textAlign: 'center' }}>Accts</th>
                                  <th style={{ textAlign: 'right' }}>Per Acct</th>
                                  <th style={{ textAlign: 'right' }}>Total Due</th>
                                  <th style={{ textAlign: 'center' }}>Start</th>
                                  <th style={{ textAlign: 'center' }}>Cycle</th>
                                  <th style={{ textAlign: 'center' }}>Last Pay</th>
                                  <th style={{ textAlign: 'center' }}>Progress</th>
                                  <th style={{ textAlign: 'center' }}>Defaults</th>
                                  <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(u.plans || []).map(p => (
                                  <tr key={p.plan_id} style={{ background: p.is_matured ? '#f0fdf4' : 'transparent' }}>
                                    <td style={{ padding: '8px 12px' }}>
                                      <span style={{
                                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                                        background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600,
                                        color: PLAN_COLORS[p.plan_name] || '#333'
                                      }}>
                                        {p.plan_name}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{p.number_of_accounts}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₦{p.per_account_amount?.toLocaleString()}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>₦{p.expected_installment?.toLocaleString()}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{formatShort(p.start_date)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: p.is_matured ? '#16a34a' : '#64748b' }}>
                                      {p.days_since_start}d / {p.duration_days}d
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: p.last_payment_date ? 'inherit' : '#94a3b8' }}>
                                      {p.last_payment_date ? formatShort(p.last_payment_date) : 'Never'}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{
                                          flex: 1, height: 6, borderRadius: 3,
                                          background: '#e2e8f0', overflow: 'hidden', minWidth: 60
                                        }}>
                                          <div style={{
                                            width: `${p.progress_pct}%`, height: '100%',
                                            background: p.progress_pct >= 100 ? '#16a34a' : '#800020',
                                            borderRadius: 3, transition: 'width 0.3s'
                                          }} />
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
                                          {p.progress_pct}%
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {(p.defaults || []).length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                          {(p.defaults || []).map(d => (
                                            <span key={d.id} style={{
                                              display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                                              background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                              fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap'
                                            }}>
                                              ₦{parseFloat(d.penalty_amount).toLocaleString()} ({formatShort(d.missed_date)})
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {p.plan_status === 'eligibility_review' ? (
                                        <span style={{
                                          display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                                          fontSize: '0.7rem', fontWeight: 700,
                                          background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'
                                        }}>REVIEW</span>
                                      ) : p.is_matured ? (
                                        <span style={{
                                          display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                                          fontSize: '0.7rem', fontWeight: 700,
                                          background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0'
                                        }}>MATURED</span>
                                      ) : (
                                        <span style={{
                                          display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                                          fontSize: '0.7rem', fontWeight: 600,
                                          background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                                        }}>{p.duration_days - p.days_since_start}d left</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuePaymentsPage;
