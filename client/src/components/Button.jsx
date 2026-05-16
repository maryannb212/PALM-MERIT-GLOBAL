import React from 'react';
import { Link } from 'react-router-dom';
import './Button.css';

const Button = ({ children, variant = 'primary', to, onClick, type = 'button', className = '' }) => {
  const baseClass = `btn btn-${variant} ${className}`;

  if (to) {
    return (
      <Link to={to} className={baseClass} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={baseClass}>
      {children}
    </button>
  );
};

export default Button;
