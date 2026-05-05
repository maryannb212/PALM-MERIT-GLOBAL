import React from 'react';
import './AboutPage.css';

const AboutPage = () => {
  return (
    <div className="about-page">
      <div className="page-header">
        <div className="container">
          <h1>About Us</h1>
          <p>Discover the driving force behind Palm Merit Global Resources</p>
        </div>
      </div>

      <section className="section container">
        <div className="vision-mission-grid">
          <div className="vm-card">
            <div className="vm-icon">👁️</div>
            <h2>Our Vision</h2>
            <p>
              We aspire to carve a niche as one of the global non-governmental organizations that touch the lives of vulnerable families, empower youths with practical skills, restore hope to communities, and ensure dignity for all.
            </p>
          </div>
          
          <div className="vm-card">
            <div className="vm-icon">🚀</div>
            <h2>Our Mission</h2>
            <p>
              To collectively mobilize community resources for humanitarian support, skills acquisition, empowerment programs, and food security through our structured global merit models.
            </p>
          </div>
        </div>
      </section>

      <section className="section bg-light">
        <div className="container">
          <div className="section-header text-center">
            <h2>Our Core Values</h2>
            <p>The principles that guide our every action</p>
          </div>
          
          <div className="values-grid">
            <div className="value-item">
              <span className="value-letter">P</span>
              <h4>Purpose</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">A</span>
              <h4>Accountable</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">L</span>
              <h4>Love</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">M</span>
              <h4>Morals</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">M</span>
              <h4>Mentorship</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">E</span>
              <h4>Empowerment</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">R</span>
              <h4>Resilience</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">I</span>
              <h4>Impact</h4>
            </div>
            <div className="value-item">
              <span className="value-letter">T</span>
              <h4>Transformation</h4>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
