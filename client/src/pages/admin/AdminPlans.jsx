import React from 'react';
import { FaPiggyBank, FaClock, FaPercentage, FaArrowRight, FaShieldAlt, FaInfoCircle } from 'react-icons/fa';
import '../dashboard/Dashboard.css';
import './Admin.css';

const PACKAGES = [
  {
    id: 'CREST',
    name: 'CREST Programme',
    registration: '₦3,000',
    contribution: '₦4,000 weekly',
    duration: '12 Weeks',
    target: '₦48,000',
    payout: '₦96,000 (with benefits)',
    status: 'ACTIVE'
  },
  {
    id: 'SILVER',
    name: 'SILVER Programme',
    registration: '₦2,500',
    contribution: '₦1,500 weekly',
    duration: '50 Weeks',
    target: '₦75,000',
    payout: '₦150,000 (with benefits)',
    status: 'ACTIVE'
  },
  {
    id: 'GOLDEN_BASKET',
    name: 'GOLDEN BASKET Programme',
    registration: '₦3,000',
    contribution: '₦2,000 weekly',
    duration: '50 Weeks',
    target: '₦100,000',
    payout: '₦100,000 + Benefits',
    status: 'ACTIVE'
  },
  {
    id: 'ISUSU',
    name: 'ISUSU Daily Savings',
    registration: 'Free',
    contribution: '₦500 daily (min)',
    duration: '30 Days',
    target: '₦15,000',
    payout: '₦15,000',
    status: 'ACTIVE'
  }
];

const AdminPlans = () => {
  return (
    <div className="admin-page-content">
      <header className="dashboard-header">
        <div className="header-title">
          <div className="header-icon"><FaPiggyBank /></div>
          <div>
            <h2>Savings Plan Configurations</h2>
            <p className="text-muted">Review and manage the parameters of Palm Merit Global programs.</p>
          </div>
        </div>
      </header>

      <div className="notification-alert info-alert">
        <FaInfoCircle />
        <span>Plan parameters are currently defined in the core system configuration. To modify interest rates or durations, please contact the technical department.</span>
      </div>

      <div className="plans-management-grid mt-4">
        {PACKAGES.map((plan) => (
          <div key={plan.id} className="admin-card plan-config-card">
            <div className="plan-config-header">
              <div className="plan-name-badge">
                <FaShieldAlt />
                <h3>{plan.name}</h3>
              </div>
              <span className="badge-status status-verified">{plan.status}</span>
            </div>

            <div className="plan-config-details">
              <div className="config-item">
                <span className="label">Registration Fee</span>
                <span className="value">{plan.registration}</span>
              </div>
              <div className="config-item">
                <span className="label">Regular Contribution</span>
                <span className="value">{plan.contribution}</span>
              </div>
              <div className="config-item">
                <span className="label"><FaClock size={12} /> Maturity Duration</span>
                <span className="value">{plan.duration}</span>
              </div>
              <div className="config-item highlight">
                <span className="label">Target Savings</span>
                <span className="value">{plan.target}</span>
              </div>
              <div className="config-item highlight secondary">
                <span className="label">Expected Payout</span>
                <span className="value">{plan.payout}</span>
              </div>
            </div>

            <div className="plan-config-actions mt-4">
              <button className="btn-outline-burgundy btn-sm disabled" title="Modifications restricted">
                Adjust Parameters
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card mt-5 p-4">
        <h4 className="mb-3">Global Rules & Inter-Plan Dependencies</h4>
        <div className="rules-list">
          <div className="rule-item">
            <FaArrowRight size={12} />
            <p><strong>Crest-Silver Ratio:</strong> Users must maintain 1 SILVER account for every 20 CREST accounts.</p>
          </div>
          <div className="rule-item">
            <FaArrowRight size={12} />
            <p><strong>Bulk Limit:</strong> Maximum of 100 account subscriptions per member per month.</p>
          </div>
          <div className="rule-item">
            <FaArrowRight size={12} />
            <p><strong>Maturity Buffer:</strong> Settlement dates are automatically set to 7 days post-clearance.</p>
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .plans-management-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 25px;
        }
        .plan-config-card {
          padding: 25px;
          border-top: 4px solid var(--color-primary);
        }
        .plan-config-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .plan-name-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--color-primary);
        }
        .plan-name-badge h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #1e293b;
        }
        .plan-config-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .config-item {
          display: flex;
          justify-content: space-between;
          padding-bottom: 10px;
          border-bottom: 1px dashed #e2e8f0;
          font-size: 0.9rem;
        }
        .config-item .label { color: #64748b; font-weight: 500; }
        .config-item .value { color: #1e293b; font-weight: 700; }
        .config-item.highlight {
          border-bottom: none;
          background: #f8fafc;
          padding: 10px;
          border-radius: 8px;
        }
        .config-item.highlight.secondary {
          background: rgba(212, 175, 55, 0.05);
        }
        .config-item.highlight .value { color: var(--color-primary); font-size: 1rem; }
        .info-alert {
          background: #eff6ff;
          color: #1e40af;
          border-left: 4px solid #3b82f6;
        }
        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .rule-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #475569;
          font-size: 0.9rem;
        }
        .rule-item strong { color: var(--color-primary); }
      `}</style>
    </div>
  );
};

export default AdminPlans;
