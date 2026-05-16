import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaEnvelope, FaWhatsapp } from 'react-icons/fa';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-col">
          <div className="footer-logo">
            <img src="/logo.png" alt="Logo" className="footer-logo-img" />
            <h3>Palm Merit Global</h3>
          </div>
          <p className="footer-desc">
            Touch the lives of vulnerable families, empower youths with practical skills, restore hope to communities, and ensure dignity for all.
          </p>
          <div className="social-icons">
            <a href="https://facebook.com/palmmerit" target="_blank" rel="noreferrer" className="social-icon"><FaFacebook /></a>
            <a href="https://instagram.com/palmmerit" target="_blank" rel="noreferrer" className="social-icon"><FaInstagram /></a>
            <a href="https://wa.me/2347026409761" target="_blank" rel="noreferrer" className="social-icon"><FaWhatsapp /></a>
            <a href="mailto:info@palmmeritglobal.com" className="social-icon"><FaEnvelope /></a>
          </div>
        </div>
        
        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About Us Mission</Link></li>
            <li><Link to="/terms">Terms & Conditions</Link></li>
            <li><Link to="/register">Join the Community</Link></li>
          </ul>
        </div>
        
        <div className="footer-col">
          <h4>Our Pillars</h4>
          <ul className="footer-links">
            <li>Community Growth</li>
            <li>Skills Acquisition</li>
            <li>Humanitarian Support</li>
            <li>Food Security</li>
          </ul>
        </div>
        
        <div className="footer-col">
          <h4>Contact Us</h4>
          <ul className="footer-contact">
            <li><strong>Email:</strong> info@palmmeritglobal.com</li>
            <li><strong>WhatsApp:</strong> +234 702 640 9761</li>
            <li><strong>Phone:</strong> +234 701 259 7990</li>
            <li><strong>Address:</strong> Global Merit Center, Lagos</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Palm Merit Global Resources. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
