import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaArrowUp, FaArrowDown, FaBalanceScale } from 'react-icons/fa';
import './AdminCashflow.css';

const AdminCashflow = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCashflow = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const response = await axios.get('/api/admin/cashflow', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(response.data);
      } catch (error) {
        console.error('Error fetching cashflow:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCashflow();
  }, []);

  if (loading) return <div>Loading Cash Flow Statement...</div>;
  if (!data) return <div>Failed to load cash flow data.</div>;

  const { summary } = data;
  const isPositiveFlow = summary.netFlow >= 0;

  return (
    <div className="admin-cashflow">
      <h2>Cash Flow Statement</h2>
      
      <div className="cashflow-summary-cards">
        <div className="cf-card inflow">
          <div className="cf-icon"><FaArrowDown /></div>
          <div className="cf-details">
            <h3>Total Inflow</h3>
            <p>₦{summary.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <small>Deposits, Memberships, Top-ups</small>
          </div>
        </div>

        <div className="cf-card outflow">
          <div className="cf-icon"><FaArrowUp /></div>
          <div className="cf-details">
            <h3>Total Outflow</h3>
            <p>₦{summary.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <small>Withdrawals: ₦{summary.breakdown.withdrawals.toLocaleString()}</small><br/>
            <small>Payouts: ₦{summary.breakdown.payouts.toLocaleString()}</small>
          </div>
        </div>

        <div className={`cf-card netflow ${isPositiveFlow ? 'positive' : 'negative'}`}>
          <div className="cf-icon"><FaBalanceScale /></div>
          <div className="cf-details">
            <h3>Net Flow</h3>
            <p>₦{summary.netFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <small>{isPositiveFlow ? 'Positive Cash Flow' : 'Negative Cash Flow'}</small>
          </div>
        </div>
      </div>

      <div className="cashflow-details mt-4">
        <h3>Recent Trends (Last 30 Days)</h3>
        <p>Inflow vs Outflow analysis can be integrated with charting libraries (e.g., Recharts) here.</p>
        
        {/* Placeholder for future charting or data table */}
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Daily Inflow</th>
                <th>Daily Outflow</th>
              </tr>
            </thead>
            <tbody>
              {/* This is a simplified merge of trends for display. 
                  In a real scenario, you'd merge the arrays by date properly. */}
              {data.trends.inflow.slice(0, 5).map((inf, idx) => (
                <tr key={idx}>
                  <td>{new Date(inf.date).toLocaleDateString()}</td>
                  <td className="text-success">+₦{parseFloat(inf.daily_inflow).toLocaleString()}</td>
                  <td className="text-danger">-₦{parseFloat(data.trends.outflow.find(o => o.date === inf.date)?.daily_outflow || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCashflow;
