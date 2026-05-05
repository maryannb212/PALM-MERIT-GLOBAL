import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyMembership } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyMembership = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  const reference = searchParams.get('reference');

  useEffect(() => {
    const verify = async () => {
      if (!reference) {
        setError('Missing transaction reference.');
        setStatus('error');
        return;
      }

      try {
        const { data } = await verifyMembership(reference);
        if (data.transaction.status === 'completed') {
          updateUser({ hasPaidMembership: true });
          setStatus('success');
          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          setError('Payment not completed.');
          setStatus('error');
        }
      } catch (err) {
        setError('Failed to verify payment.');
        setStatus('error');
      }
    };

    verify();
  }, [reference, navigate, updateUser]);

  return (
    <div className="verify-container" style={{ textAlign: 'center', padding: '50px' }}>
      {status === 'verifying' && (
        <>
          <div className="spinner"></div>
          <h2>Verifying Membership Payment...</h2>
          <p>Please wait while we confirm your transaction.</p>
        </>
      )}
      
      {status === 'success' && (
        <div className="success-message">
          <span style={{ fontSize: '4rem' }}>🎉</span>
          <h2>Payment Successful!</h2>
          <p>Welcome to Palm Merit. Redirecting to your dashboard...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="error-message">
          <span style={{ fontSize: '4rem' }}>❌</span>
          <h2>Verification Failed</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Try Again</button>
        </div>
      )}
    </div>
  );
};

export default VerifyMembership;
