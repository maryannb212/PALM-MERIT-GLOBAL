import React, { useState, useEffect } from 'react';
import { getCashflow } from '../../services/api';
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaMoneyBillWave, FaChartLine, FaHistory } from 'react-icons/fa';
import './AdminCashflow.css';
import './Admin.css';

const AdminCashflow = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCashflowData = async () => {
      try {
        setLoading(true);
        const response = await getCashflow();
        setData(response.data);
      } catch (error) {
        console.error('Error fetching cashflow:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCashflowData();
  }, []);

  if (loading) {
    return (
      <div className="admin-page-content">
        <div className="table-loader">
          <div className="spinner-small"></div>
          <span>Generating financial report...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-page-content">
        <div className="alert alert-error">Failed to load platform cash flow data.</div>
      </div>
    );
  }

  const { summary } = data;
  const isPositiveFlow = summary.netFlow >= 0;

  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaChartLine /></div>
          <div>
            <h2>Cash Flow Statement</h2>
            <p className="text-muted">Real-time analysis of platform liquidity and capital movement.</p>
          </div>
        </div>
      </header>
      
      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-icon-wrapper"><FaArrowDown /></div>
          <div className="stat-info">
            <h3>Total Inflow</h3>
            <div className="stat-value">₦{summary.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="stat-label text-success">Deposits & Membership Fees</p>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon-wrapper"><FaArrowUp /></div>
          <div className="stat-info">
            <h3>Total Outflow</h3>
            <div className="stat-value">₦{summary.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="stat-label text-danger">Withdrawals & Maturity Payouts</p>
          </div>
        </div>

        <div className={`stat-card ${isPositiveFlow ? 'primary' : 'warning'}`}>
          <div className="stat-icon-wrapper"><FaBalanceScale /></div>
          <div className="stat-info">
            <h3>Net Liquidity</h3>
            <div className="stat-value">₦{summary.netFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className={`stat-label ${isPositiveFlow ? 'text-primary' : 'text-warning'}`}>
              {isPositiveFlow ? 'Positive Operational Flow' : 'Negative Operational Flow'}
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-section mt-5">
        <div className="section-header">
          <h3><FaHistory /> Periodic Performance (Last 30 Days)</h3>
        </div>
        
        <div className="admin-card table-card mt-3">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Settlement Date</th>
                  <th>Daily Inflow</th>
                  <th>Daily Outflow</th>
                  <th className="text-right">Net Daily Position</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.inflow.slice(0, 10).map((inf, idx) => {
                  const outf = data.trends.outflow.find(o => o.date === inf.date)?.daily_outflow || 0;
                  const net = parseFloat(inf.daily_inflow) - parseFloat(outf);
                  return (
                    <tr key={idx} className="table-row-hover">
                      <td className="date-cell">{new Date(inf.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="text-success font-weight-bold">+₦{parseFloat(inf.daily_inflow).toLocaleString()}</td>
                      <td className="text-danger font-weight-bold">-₦{parseFloat(outf).toLocaleString()}</td>
                      <td className="text-right font-weight-bold">
                        <span className={net >= 0 ? 'text-success' : 'text-danger'}>
                          {net >= 0 ? '+' : ''}₦{net.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCashflow;
