import React from 'react';
import './TermsPage.css';

const terms = [
  ['Membership', ['Membership is open to persons 18 years and above.', 'Members are expected to provide correct information during registration and comply with the rules of their chosen programme.']],
  ['Account Security', ['Members are responsible for keeping their username, password and account details safe.', 'Palm Merit will not be responsible for losses caused by a member sharing their login details or allowing an unauthorised person to access their account.', 'Members should only transact through official approved representatives, website or app.']],
  ['Fraud and Scam Warning', ['Beware of scammers and fake representatives.', 'Palm Merit will not be responsible for money sent to unauthorised persons or through unofficial channels.', 'Always contact our official customer service channels or visit our office when in doubt.']],
  ['Contributions and Member Responsibilities', ['Members are expected to follow the rules and requirements of their chosen cooperative programme.', 'Members must maintain any required active downline/referral within the stated period of their programme.', 'An account that does not meet the required downline or programme conditions may not qualify for settlement, bonuses, incentives or other benefits attached to the programme.']],
  ['Referral Links', ['Members are responsible for monitoring and using their referral links within the required period.', 'Any account whose referral link expires will attract a 30% deduction penalty.', 'Any member found selling, buying, transferring or trading referral links for payment may have their account restricted, suspended, investigated or subjected to other disciplinary action by Management. Such violations may also affect eligibility for referral benefits, bonuses, incentives, settlement or other programme benefits.', 'Members are therefore strongly advised NOT to buy or sell referral links under any circumstances.']],
  ['Fees, Fines and Penalties', ['Registration fees, service fees, fines, penalties and other applicable charges paid by members are non-refundable, except where Management expressly approves otherwise.', 'Members are advised to understand the applicable rules before making payments or participating in any programme.']],
  ['Account Termination or Withdrawal', ['Any request to terminate an account or withdraw membership must be made in writing and is subject to Management’s approval.', 'Accounts registered as downlines or created through referral links are not eligible for termination where such termination is restricted by the applicable programme rules.']],
  ['Account Transfer and Sale', ['Buying or exchanging an account.', 'Transferring an account to another person.', 'Duplicating or creating unauthorised accounts.', 'Operating an account through another person by proxy (impersonation). Violation of this rule may result in account suspension, termination and/or further disciplinary action.']],
  ['Food Items, Incentives, Bonuses and Rewards', ['Food items, incentives, bonuses and rewards are subject to the terms, conditions and discretion of Management.', 'They are not automatic entitlements unless expressly stated under the applicable programme.', 'Members must meet all qualifying requirements before any incentive, bonus or reward can be granted.']],
  ['Clearance, Verification and Settlement', ['All qualified accounts must complete the required clearance and verification process before settlement.', 'After successful verification, qualified accounts will be processed for settlement within 14 days, subject to completion of all required conditions and documentation.', 'A clearance request does not automatically mean that an account is immediately eligible for settlement.']],
  ['Official Information Channels', ['Members should rely only on Palm Merit’s verified official social media handles, official website/app, office and authorised communication channels for company information.', 'Members should not create or operate unauthorised Palm Merit groups, platforms or services for the purpose of collecting money or charging members without Management’s approval.']],
  ['Conduct and Discipline', ['Palm Merit expects all members to communicate respectfully with the company, staff, representatives and other members.', 'Fraud, impersonation, abuse, threats, defamation, deliberate misinformation, disruptive behaviour, disrespect or any other serious misconduct may result in account suspension, penalties, termination of membership and/or reporting to the appropriate authorities where necessary.']],
  ['Complaints and Customer Service', ['All complaints, account issues and challenges must be reported through the official customer service channels.', 'Complaints will be reviewed and processed within 7 working days, depending on the nature of the issue and the information required.', 'Members are advised not to engage in public disputes or rely on unauthorised persons to resolve account issues.']],
  ['Regulatory and Financial Responsibility', ['PALM MERIT COOPERATIVE MULTIPURPOSE SOCIETY LIMITED is a cooperative society and is not a bank, investment company or Ponzi scheme.', 'Members are responsible for complying with applicable Nigerian laws and regulations when making financial transactions.', 'For cooperative contributions, members should use the appropriate transaction description or narration as instructed by the company.', 'Palm Merit will not be responsible for regulatory issues, restrictions or losses resulting from a member’s failure to follow official instructions or applicable laws.']]
];

const TermsPage = () => {
  return (
    <div className="terms-page public-document-page">
      <div className="page-header"><div className="container">
        <span className="eyebrow">PALM MERIT COOPERATIVE</span>
        <h1>Terms and Conditions</h1>
        <p>Please read these terms carefully before registering or participating in any Palm Merit programme.</p>
      </div></div>
      <section className="section container terms-document">
        <div className="terms-intro"><strong>PALM MERIT COOPERATIVE<br />MULTIPURPOSE SOCIETY LIMITED</strong><p>By registering, you agree to comply with these terms.</p></div>
        {terms.map(([title, points], index) => <section className="terms-section" key={title}><div className="terms-number">{String(index + 1).padStart(2, '0')}</div><div><h2>{title}</h2><ul>{points.map((point) => <li key={point}>{point}</li>)}</ul></div></section>)}
        <section className="terms-section"><div className="terms-number">15</div><div><h2>Acceptance of Terms</h2><p>By registering for or participating in any Palm Merit programme, you confirm that you have read, understood and agreed to these Terms and Conditions.</p><p>Management reserves the right to review and update these Terms and Conditions when necessary. Members will be expected to comply with the current terms applicable to their programme.</p><strong>PALM MERIT COOPERATIVE<br />MULTIPURPOSE SOCIETY LIMITED<br />Management</strong></div></section>
      </section>
    </div>
  );
};

export default TermsPage;
