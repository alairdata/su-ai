"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference');

      if (!reference) {
        setStatus('error');
        setMessage('Invalid payment reference');
        return;
      }

      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
          setMessage('Payment successful! Upgrading your plan...');
          
          await updateSession();
          
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Payment verification failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Failed to verify payment');
      }
    };

    verifyPayment();
  }, [searchParams, router, updateSession]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'verifying' && (
          <>
            <div style={styles.spinner}>⏳</div>
            <h2 style={styles.title}>{message}</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={styles.success}>✅</div>
            <h2 style={styles.title}>Payment Successful!</h2>
            <p style={styles.message}>{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={styles.error}>❌</div>
            <h2 style={styles.title}>Payment Failed</h2>
            <p style={styles.message}>{message}</p>
            <button 
              onClick={() => router.push('/')}
              style={styles.button}
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense
export default function PaymentCallback() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner}>⏳</div>
          <h2 style={styles.title}>Loading...</h2>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9f9f9',
    padding: '24px',
  } as React.CSSProperties,
  card: {
    maxWidth: '500px',
    width: '100%',
    padding: '48px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  spinner: {
    fontSize: '48px',
    marginBottom: '24px',
  } as React.CSSProperties,
  success: {
    fontSize: '64px',
    marginBottom: '24px',
  } as React.CSSProperties,
  error: {
    fontSize: '64px',
    marginBottom: '24px',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '16px',
    color: '#000',
  } as React.CSSProperties,
  message: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
  } as React.CSSProperties,
  button: {
    padding: '12px 32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
};