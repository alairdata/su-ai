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
      const sessionId = searchParams.get('session_id');

      if (!sessionId) {
        setStatus('error');
        setMessage('Invalid payment session');
        return;
      }

      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
          setMessage(`Welcome to ${data.plan}! Your plan has been upgraded.`);

          await updateSession();

          setTimeout(() => {
            router.push('/');
          }, 2500);
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
            <div style={styles.spinner}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </path>
              </svg>
            </div>
            <h2 style={styles.title}>{message}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.success}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 style={styles.title}>Payment Successful!</h2>
            <p style={styles.message}>{message}</p>
            <p style={styles.redirect}>Redirecting you back...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.error}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
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
          <div style={styles.spinner}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
              </path>
            </svg>
          </div>
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
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  success: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  error: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
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
    marginBottom: '16px',
  } as React.CSSProperties,
  redirect: {
    fontSize: '14px',
    color: '#999',
  } as React.CSSProperties,
  button: {
    padding: '12px 32px',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #3d3d3d 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
};
