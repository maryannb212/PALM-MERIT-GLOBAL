import React from 'react';
import { Link } from 'react-router-dom';
import './ProgrammeCard.css';

const ProgrammeCard = ({ title, duration, registration, weekly, total, roi, isDaily, highlight }) => {
  return (
    <div className={`programme-card ${highlight ? 'highlight' : ''}`}>
      {highlight && <div className="card-badge">Popular</div>}
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        <ul className="card-features">
          <li><strong>Duration:</strong> {duration}</li>
          <li><strong>Registration:</strong> {registration}</li>
          <li><strong>{isDaily ? 'Daily Minimum:' : 'Weekly:'}</strong> {weekly}</li>
          <li><strong>Total Value:</strong> {total}</li>
        </ul>
        <div className="card-roi">
          <span className="roi-label">Return / Benefit:</span>
          <span className="roi-value">{roi}</span>
        </div>
      </div>
      <div className="card-footer">
        <Link to="/register" className="btn btn-outline btn-block">Join {title}</Link>
      </div>
    </div>
  );
};

export default ProgrammeCard;
