import React from 'react';
import Button from './Button';
import './Hero.css';

const Hero = ({ title, subtitle, bgImage, ctaText, ctaLink }) => {
  return (
    <div className="hero-section" style={{ backgroundImage: bgImage ? `linear-gradient(rgba(10, 104, 71, 0.8), rgba(26, 26, 46, 0.9)), url(${bgImage})` : 'linear-gradient(135deg, var(--color-primary-dark), var(--color-bg-dark))' }}>
      <div className="container hero-container">
        <div className="hero-content">
          <img src="/logo.png" alt="Palm Merit Global Logo" style={{ width: '120px', marginBottom: '20px' }} />
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{subtitle}</p>
          {ctaText && ctaLink && (
            <div className="hero-cta">
              <Button variant="accent" to={ctaLink}>{ctaText}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hero;
