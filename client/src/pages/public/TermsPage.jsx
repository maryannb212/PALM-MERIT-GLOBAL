import React from 'react';

const TermsPage = () => {
  return (
    <div className="terms-page">
      <div className="page-header">
        <div className="container">
          <h1>Terms & Conditions</h1>
          <p>Please read our legal terms carefully before participating</p>
        </div>
      </div>

      <section className="section container">
        <div className="content-box" style={{ background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#0A6847', marginBottom: '20px' }}>TERMS & CONDITIONS OF PALM MERIT GLOBAL LIMITED</h2>
          
          <ul style={{ marginBottom: '25px', paddingLeft: '20px', lineHeight: '1.8', listStyleType: 'disc' }}>
            <li>Palm Merit Global Limited is a registered business entity and not a bank or investment company.</li>
            <li>We cooperate with each on joint and several membership union to put food on our tables and provide financial support.</li>
            <li>All registration and processing fees are non-refundable.</li>
            <li>Members must provide correct personal information during registration.</li>
            <li>Fake accounts or multiple fraudulent accounts are prohibited.</li>
            <li>Every member must complete savings cycle and clearance before payment.</li>
            <li>Payments/Settlements are processed on or before 14 working days after successful clearance.</li>
            <li>Food items or incentives will be distributed on scheduled dates at management discretion.</li>
            <li>Any form of disrespect, abuse, or misconduct toward staff will be penalized.</li>
            <li>Fraud, impersonation, or false claims will lead to account suspension.</li>
            <li>Members should deal only with official company contacts.</li>
            <li>The company is not responsible for payments credited to unauthorized persons due to, and/ or accounts provided by the member.</li>
            <li>Complaints must be reported to customer care for resolution.</li>
            <li>Management reserves the right to review or update policies at any time.</li>
            <li>Participation in our programmes and activities confirms acceptance of our company terms and conditions.</li>
          </ul>

          <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '5px', borderLeft: '4px solid #0A6847' }}>
            <p style={{ marginBottom: '15px' }}><strong>Food items/ incentives are the exclusive right of the company and to be determined by the Company management in accordance with the economic situation.</strong></p>
            <p style={{ marginBottom: '15px' }}><strong>Cancellation, Termination and / withdrawal of membership contributory programme must follow process policy and can only be refunded at the completion of the programme cycle.</strong></p>
            <p><strong>All members and or you intending members are advised to carefully understand the policy, processes of the company before selecting membership option, as no reversals shall be allowed after signing in.</strong></p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsPage;
