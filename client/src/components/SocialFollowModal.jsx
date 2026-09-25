import React from 'react';
import { FaFacebookF, FaInstagram, FaTimes } from 'react-icons/fa';

const SocialFollowModal = ({ onClose }) => (
  <div className="social-follow-overlay" role="dialog" aria-modal="true" aria-labelledby="social-follow-title">
    <section className="social-follow-modal">
      <button type="button" className="social-follow-close" onClick={onClose} aria-label="Close social follow reminder">
        <FaTimes />
      </button>
      <div className="social-follow-icon" aria-hidden="true">🌴</div>
      <span className="social-follow-kicker">PALM MERIT COMMUNITY</span>
      <h2 id="social-follow-title">Stay connected with Palm Merit</h2>
      <p>
        Follow us and join the conversation. Engage with our updates for a chance to win a prize as the
        <strong> Best Engaged Palm Meriter</strong>.
      </p>
      <div className="social-follow-actions">
        <a href="https://www.instagram.com/palmmeritglobal?utm_source=qr&stkn=MWxlOTQ1Zm1mdjA2MA==" target="_blank" rel="noreferrer" className="social-follow-link instagram">
          <FaInstagram /> Follow on Instagram
        </a>
        <a href="https://www.facebook.com/share/1Hh13e7CPU/" target="_blank" rel="noreferrer" className="social-follow-link facebook">
          <FaFacebookF /> Follow on Facebook
        </a>
      </div>
      <button type="button" className="social-follow-later" onClick={onClose}>Maybe later</button>
    </section>
  </div>
);

export default SocialFollowModal;
