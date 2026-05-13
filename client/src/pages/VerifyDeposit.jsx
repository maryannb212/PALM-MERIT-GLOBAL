import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyDeposit } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyDeposit = () => {
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
        const { data } = await verifyDeposit(reference);

        if (data.transaction.status === 'completed') {
          setStatus('success');
          // Refresh profile to get updated balance
          setTimeout(() => navigate('/dashboard/wallet'), 2000);
        } else {
          setError('Payment not completed.');
          setStatus('error');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to verify payment.');
        setStatus('error');
      }
    };

    verify();
  }, [reference, navigate]);

  return (
    <div className="verify-container" style={{
      textAlign: 'center',
      padding: '100px 20px',
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f4f7f6'
    }}>
      <div style={{
        background: '#fff',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        maxWidth: '500px',
        width: '100%'
      }}>
        {status === 'verifying' && (
          <>
            <div className="spinner" style={{
              width: '50px',
              height: '50px',
              border: '5px solid #e1e1e1',
              borderTop: '5px solid #800020',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <h2 style={{ color: '#333' }}>Verifying Your Deposit...</h2>
            <p style={{ color: '#666' }}>Please wait while we confirm your transaction with the bank.</p>
          </>
        )}

        {status === 'success' && (
          <div className="success-message">
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>✅</div>
            <h2 style={{ color: '#800020' }}>Deposit Successful!</h2>
            <p style={{ color: '#666' }}>Your wallet balance has been updated. Redirecting you back to your wallet...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="error-message">
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>❌</div>
            <h2 style={{ color: '#d32f2f' }}>Verification Failed</h2>
            <p style={{ color: '#666' }}>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/dashboard/wallet')}
              style={{
                marginTop: '20px',
                background: '#800020',
                color: '#fff',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Back to Wallet
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VerifyDeposit;
