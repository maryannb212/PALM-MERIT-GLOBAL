import React, { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import './PublicInfoPage.css';

const questions = [
  ['What is Palm Merit Cooperative?', 'Palm Merit Cooperative Multipurpose Society Limited is a cooperative society that provides structured programmes for members to save towards defined goals and participate in community-led empowerment initiatives.'],
  ['How do I become a member?', 'Create an account through the official website, provide accurate information, and select the programme that matches your goals. You must be at least 18 years old.'],
  ['Which programme should I choose?', 'CREST is a focused 90-day savings cycle. SILVER is designed for steady, longer-term capital growth. GOLDEN BASKET combines savings with food security benefits. Review the programme details before registering.'],
  ['How are contributions made?', 'Members make contributions according to the rules and frequency of their chosen programme. Always use the official website, app, or approved representatives and follow the transaction instructions provided.'],
  ['When does settlement happen?', 'Qualified accounts must complete the required clearance and verification process first. After successful verification, qualified accounts are processed within 14 days, subject to all required conditions and documentation.'],
  ['How can I get help with my account?', 'Use the official customer service channels listed on the website. Complaints and account challenges are reviewed and processed within 7 working days, depending on the information required.'],
  ['How do I stay safe from scams?', 'Palm Merit will never ask you to send money through an unauthorised channel. Do not buy, sell, or transfer referral links, and contact official customer service whenever you are unsure.']
];

const FAQPage = () => {
  const [openQuestion, setOpenQuestion] = useState(0);
  return <div className="public-info-page"><header className="info-hero"><div className="container"><span className="eyebrow">NEED CLARITY?</span><h1>Frequently asked questions.</h1><p>Everything you need to understand your Palm Merit journey before you begin.</p></div></header><main className="section container faq-layout"><div className="info-aside"><span className="eyebrow">PALM MERIT GUIDE</span><h2>Good decisions start with clear information.</h2><p>Read through the common questions below. Our official customer service channels are available when you need more help.</p></div><div className="faq-list">{questions.map(([question, answer], index) => <div className={`faq-item ${openQuestion === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)} aria-expanded={openQuestion === index}><span>{question}</span><FaChevronDown /></button>{openQuestion === index && <p>{answer}</p>}</div>)}</div></main></div>;
};

export default FAQPage;