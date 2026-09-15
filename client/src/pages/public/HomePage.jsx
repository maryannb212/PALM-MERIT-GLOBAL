import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';
import { FaArrowRight, FaCheck, FaQuoteLeft, FaShieldAlt, FaUsers, FaWallet } from 'react-icons/fa';

const plans = [
  { name: 'CREST', label: 'Focused savings', amount: '₦4,000', target: '₦48,000', cycle: '90 days', tone: 'crest' },
  { name: 'SILVER', label: 'Steady capital', amount: '₦1,500', target: '₦75,000', cycle: '360 days', tone: 'silver', featured: true },
  { name: 'GOLDEN BASKET', label: 'Savings + food security', amount: '₦2,000', target: '₦100,000', cycle: '360 days', tone: 'gold' }
];

const testimonials = [
  { quote: 'Palm Merit celebrates progress and gives members a clear path towards meaningful goals.', name: 'Charles Nwachukwu', role: 'Palm Merit member', image: '/testimonials/IMG_5427.jpeg' },
  { quote: 'The cooperative makes every milestone feel like a shared achievement.', name: 'Gladys Kingsley', role: 'Palm Merit member', image: '/testimonials/IMG_5444.jpeg' },
  { quote: 'I am grateful for the support, structure, and opportunity to complete my programme cycle.', name: 'Stephens Florence', role: 'Palm Merit member', image: '/testimonials/IMG_5446.jpeg' },
  { quote: 'Palm Merit puts people at the center of progress.', name: 'Chinaro Maduako', role: 'Palm Merit member', image: '/testimonials/IMG_8874.jpg' }
];

const useReveal = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
};

const AnimatedAmount = ({ value }) => {
  const [ref, visible] = useReveal();
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    const duration = 1000;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setAmount(Math.floor(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return undefined;
  }, [value, visible]);
  return <span ref={ref}>₦{amount.toLocaleString()}</span>;
};

const HomePage = () => {
  const [heroMode, setHeroMode] = useState('legacy');

  useEffect(() => {
    const heroTimer = window.setInterval(() => {
      setHeroMode((currentMode) => currentMode === 'journey' ? 'legacy' : 'journey');
    }, 4000);

    return () => window.clearInterval(heroTimer);
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
        <div className="container home-hero-grid">
          <div key={heroMode} className={`home-hero-copy hero-mode-copy ${heroMode}`}>
            {heroMode === 'legacy' ? <><span className="eyebrow">PALM MERIT GLOBAL</span><h1>Unlocking Potential,<br /><em>Restoring Hope.</em></h1><p>Palm Merit Global is a humanitarian cooperative dedicated to touching lives, empowering communities, and ensuring dignity for all vulnerable families.</p><div className="hero-actions"><Link to="/register" className="btn btn-accent">Join the Community <FaArrowRight /></Link><Link to="/about" className="text-link">Our mission <FaArrowRight /></Link></div><div className="hero-proof"><span><FaCheck /> Humanitarian support</span><span><FaCheck /> Community empowerment</span></div></> : <><span className="eyebrow">PALM MERIT COOPERATIVE</span><h1>Save with purpose.<br /><em>Grow with merit.</em></h1><p>A structured cooperative community helping members build meaningful savings, reach personal targets, and create a stronger tomorrow together.</p><div className="hero-actions"><Link to="/register" className="btn btn-accent">Get Started <FaArrowRight /></Link><a href="#plans" className="text-link">Explore plans <FaArrowRight /></a></div><div className="hero-proof"><span><FaCheck /> Community-led</span><span><FaCheck /> Clear programme rules</span></div></>}
          </div>
          <div key={`visual-${heroMode}`} className={`hero-visual hero-mode-visual ${heroMode}`} aria-label="Palm Merit savings journey">
            <div className="hero-sun" />
            <div className="hero-statement glass"><span>YOUR NEXT MILESTONE</span><strong>₦48,000</strong><small>CREST target</small><div className="mini-progress"><i /></div><b>72% on track</b></div>
            <div className="hero-float hero-float-top"><FaWallet /><span>Build steadily</span></div>
            <div className="hero-float hero-float-bottom"><FaUsers /><span>Grow together</span></div>
            <div className="hero-seal"><span>PM</span><small>Est.<br />2019</small></div>
          </div>
        </div>
        <a href="#story" className="scroll-cue">Scroll to explore <span>↓</span></a>
      </section>

      <section id="story" className="story-section section">
        <div className="container story-grid">
          <div><span className="eyebrow">THE PALM MERIT WAY</span><h2>A better rhythm for the goals that matter.</h2></div>
          <div><p className="lead">Palm Merit is a cooperative built around consistency, community, and practical progress. Pick a programme that fits your season, then let every contribution move you closer to a defined target.</p><Link to="/about" className="text-link">Discover our mission <FaArrowRight /></Link></div>
        </div>
        <div className="container journey-grid">
          {[['01', 'Start your journey', 'Register as a member and choose a savings path that feels right for you.'], ['02', 'Build your target', 'Make consistent contributions with a community that keeps you accountable.'], ['03', 'Complete your cycle', 'Meet your programme conditions, complete clearance, and move towards settlement.']].map(([number, title, text]) => <div className="journey-step" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></div>)}
        </div>
      </section>

      <section id="plans" className="plans-section section">
        <div className="container"><div className="section-intro"><div><span className="eyebrow">CHOOSE YOUR PATH</span><h2>Plans with a purpose.</h2></div><p>Simple programmes. Clear targets. A steady way to turn intention into progress.</p></div>
          <div className="home-plans-grid">{plans.map((plan) => <article className={`home-plan-card ${plan.featured ? 'featured' : ''} ${plan.tone}`} key={plan.name}>{plan.featured && <span className="plan-ribbon">Member favourite</span>}<div className="plan-card-top"><span>{plan.label}</span><strong>{plan.name}</strong></div><div className="plan-target"><small>Target savings</small><b><AnimatedAmount value={Number(plan.target.replace(/[^0-9]/g, ''))} /></b><span>{plan.cycle} cycle</span></div><div className="plan-line"><span>Contribution</span><b>{plan.amount} / week</b></div><div className="plan-line"><span>Programme focus</span><b>{plan.name === 'GOLDEN BASKET' ? 'Food security' : 'Cooperative savings'}</b></div><Link to="/register" className="plan-link">Join this plan <FaArrowRight /></Link></article>)}</div>
        </div>
      </section>

      <section className="values-section section"><div className="container values-layout"><div className="values-copy"><span className="eyebrow">WHY PALM MERIT</span><h2>Progress feels different when it is shared.</h2><p>We create a practical space for members to save with clarity, learn the rules of their programme, and participate in a community designed for mutual growth.</p><Link to="/terms" className="btn btn-outline">Read our terms</Link></div><div className="values-list"><div><FaShieldAlt /><span><strong>Built on trust</strong><small>Clear expectations and official channels for every member.</small></span></div><div><FaUsers /><span><strong>Powered by community</strong><small>Collective discipline makes individual goals feel achievable.</small></span></div><div><FaWallet /><span><strong>Designed for progress</strong><small>Choose a defined target and build towards it consistently.</small></span></div></div></div></section>

      <section className="testimonials-preview section"><div className="container"><div className="section-intro"><div><span className="eyebrow">MEMBER VOICES</span><h2>Small steps. Real stories.</h2></div><Link to="/testimonials" className="text-link">Read all stories <FaArrowRight /></Link></div><div className="testimonial-grid">{testimonials.slice(0, 3).map((testimonial) => <blockquote key={testimonial.name}><img src={testimonial.image} alt={testimonial.name} /><FaQuoteLeft /><p>“{testimonial.quote}”</p><footer><strong>{testimonial.name}</strong><span>{testimonial.role}</span></footer></blockquote>)}</div></div></section>

      <section className="home-cta"><div className="container home-cta-inner"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Give your goals a structure.</h2><p>Start your Palm Merit journey today.</p><Link to="/register" className="btn btn-accent">Get Started <FaArrowRight /></Link></div></section>
    </div>
  );
};

export default HomePage;
