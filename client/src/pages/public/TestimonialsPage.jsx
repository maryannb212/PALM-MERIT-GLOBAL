import React from 'react';
import { FaQuoteLeft } from 'react-icons/fa';
import './PublicInfoPage.css';

const stories = [
  { quote: 'I was honestly doubting at first. Today, I am standing here with my foodstuffs and my savings, grateful that I stayed consistent with Palm Merit.', name: 'Gladys Kingsley', role: 'Palm Merit member', image: '/testimonials/IMG_5427.jpeg' },
  { quote: 'This journey taught me that small contributions can become something meaningful. Seeing the food items and savings come through made the whole experience real for me.', name: 'Stephens Florence', role: 'Palm Merit member', image: '/testimonials/IMG_5444.jpeg' },
  { quote: 'There were moments I wondered if I would complete my cycle, but Palm Merit gave me the structure to keep going. Today, I can celebrate both my savings and the food support I received.', name: 'Chinaro Maduako', role: 'Palm Merit member', image: '/testimonials/IMG_5446.jpeg' },
  { quote: 'I joined with hope and a little uncertainty. I completed the journey with confidence, savings in hand, and foodstuffs that made a real difference at home.', name: 'Charles rufus', role: 'Palm Merit member', image: '/testimonials/IMG_8874.jpg' }
];

const TestimonialsPage = () => <div className="public-info-page"><header className="info-hero"><div className="container"><span className="eyebrow">MEMBER VOICES</span><h1>Stories of steady progress.</h1><p>Every goal has a beginning. These are a few words from members on their Palm Merit experience.</p></div></header><main className="section container stories-page"><div className="stories-intro"><span className="eyebrow">THE COMMUNITY JOURNEY</span><h2>Progress is personal.<br />The journey is shared.</h2><p>We are building a cooperative culture where clarity, consistency, and community support every member’s next step.</p></div><div className="stories-grid">{stories.map((story) => <blockquote key={story.name}><img src={story.image} alt={story.name} /><FaQuoteLeft /><p>“{story.quote}”</p><footer><strong>{story.name}</strong><span>{story.role}</span></footer></blockquote>)}</div></main></div>;

export default TestimonialsPage;