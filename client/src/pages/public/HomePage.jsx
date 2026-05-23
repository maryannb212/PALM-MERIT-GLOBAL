import React from 'react';
import Hero from '../../components/Hero';
import ProgrammeCard from '../../components/ProgrammeCard';
import './HomePage.css';
import { FaShieldAlt, FaRegHandshake, FaChartLine } from 'react-icons/fa';

const HomePage = () => {
  return (
    <div className="home-page">
      <Hero 
        title="Unlocking Potential, Restoring Hope"
        subtitle="Palm Merit Global is a humanitarian cooperative dedicated to touching lives, empowering communities, and ensuring dignity for all vulnerable families."
        ctaText="Join the Community"
        ctaLink="/register"
      />

      <section className="about-preview section">
        <div className="container about-container">
          <div className="about-content">
            <h2>Who We Are</h2>
            <p>
              We aspire to carve a niche as one of the global non-governmental organizations that touch the lives of vulnerable families, empower youths with practical skills, restore hope to communities, and ensure dignity for all.
            </p>
            <p>
              Our mission is to collectively drive humanitarian support, skills acquisition, empowerment programs, and food security for a better tomorrow.
            </p>
            <a href="/about" className="btn btn-outline">Learn More About Our Mission</a>
          </div>
          <div className="about-features">
            <div className="feature">
              <div className="feature-icon"><FaShieldAlt /></div>
              <h4>Integrity & Trust</h4>
              <p>We operate with the highest standards of transparency and accountability in all our programs.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><FaRegHandshake /></div>
              <h4>Global Merit</h4>
              <p>Join a network of individuals committed to mutual growth and humanitarian impact.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><FaChartLine /></div>
              <h4>Empowerment</h4>
              <p>Achieve personal and community milestones through our structured empowerment initiatives.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="impact-section section bg-light">
        <div className="container">
          <div className="section-header text-center">
            <h2>Our Impact Pillars</h2>
            <p>Guided by merit, driven by compassion.</p>
          </div>
          <div className="impact-grid">
            <div className="impact-card card">
              <h3>Cooperative Empowerment</h3>
              <p>Supporting local families through collective initiatives and resource sharing.</p>
            </div>
            <div className="impact-card card">
              <h3>Skills Acquisition</h3>
              <p>Empowering the next generation with practical skills to thrive in a global economy.</p>
            </div>
            <div className="impact-card card">
              <h3>Humanitarian Support</h3>
              <p>Providing essential aid to those who need it most, restoring dignity and hope.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works section">
        <div className="container">
          <div className="section-header text-center">
            <h2>How to Participate</h2>
            <p>Join the movement in three simple steps.</p>
          </div>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Registration</h3>
              <p>Become a verified member of the Palm Merit Global community.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Onboarding</h3>
              <p>Receive your orientation and complete your merit verification.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Empowerment</h3>
              <p>Gain access to our exclusive programmes and start your journey of impact.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container text-center">
          <h2>Be Part of the Global Merit Revolution</h2>
          <p>Join us as we touch lives and restore hope across the globe.</p>
          <a href="/register" className="btn btn-accent btn-large">Join Palm Merit Global</a>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
