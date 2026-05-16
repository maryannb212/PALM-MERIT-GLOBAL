import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          <img src="/logo.png" alt="Palm Merit Global Logo" />
          <span>Palm Merit Global</span>
        </Link>
        
        <div className="menu-icon" onClick={toggleMenu}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </div>
        
        <ul className={isOpen ? 'nav-menu active' : 'nav-menu'}>
          <li className="nav-item">
            <Link to="/" className="nav-links" onClick={toggleMenu}>Home</Link>
          </li>
          <li className="nav-item">
            <Link to="/about" className="nav-links" onClick={toggleMenu}>About Us</Link>
          </li>
          <li className="nav-item">
            <Link to="/terms" className="nav-links" onClick={toggleMenu}>Terms</Link>
          </li>
          <li className="nav-item nav-buttons-mobile">
            {user ? (
              <>
                <Button variant="primary" to="/dashboard" onClick={toggleMenu}>Dashboard</Button>
                <Button variant="outline" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="outline" to="/login" onClick={toggleMenu}>Login</Button>
                <Button variant="primary" to="/register" onClick={toggleMenu}>Register</Button>
              </>
            )}
          </li>
        </ul>
        
        <div className="nav-buttons">
          {user ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="primary" to="/dashboard" className="nav-btn">Dashboard</Button>
              <Button variant="outline" onClick={handleLogout} className="nav-btn">Logout</Button>
            </div>
          ) : (
            <>
              <Button variant="outline" to="/login" className="nav-btn">Login</Button>
              <Button variant="primary" to="/register" className="nav-btn">Register</Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
