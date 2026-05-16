import React, { useEffect, useState } from 'react';
import API from '../services/api';
import './Ambassadors.css';

const Ambassadors = () => {
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAmbassadors = async () => {
      try {
        const { data } = await API.get('/ambassadors');
        setAmbassadors(data);
      } catch (error) {
        console.error('Error fetching ambassadors:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAmbassadors();
  }, []);

  if (loading) {
    return <div className="ambassadors-loading">Loading Ambassadors...</div>;
  }

  return (
    <div className="ambassadors-page">
      <div className="ambassadors-header">
        <h1>Our Ambassadors</h1>
        <p>The visionaries and team leads driving Palm Merit Global forward.</p>
      </div>

      <div className="ambassadors-grid">
        {ambassadors.map((ambassador) => (
          <div key={ambassador.id} className="ambassador-card">
            <div className="ambassador-image">
              <img 
                src={ambassador.image_url || '/placeholder-avatar.png'} 
                alt={ambassador.name} 
                onError={(e) => { e.target.src = '/placeholder-avatar.png'; }}
              />
            </div>
            <div className="ambassador-info">
              <h3>{ambassador.name}</h3>
              <span className="ambassador-role">{ambassador.role}</span>
              <p className="ambassador-bio">{ambassador.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Ambassadors;
