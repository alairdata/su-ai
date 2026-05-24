"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const provider = searchParams.get('provider');
    if (provider === 'lemonsqueezy') {
      handleLemonSqueezy();
    } else {
      handlePaystack();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLemonSqueezy = async () => {
    // LS processes payment server-side via webhook — no client verify call needed.
    // Give the webhook a moment to fire, then refresh session.
    setMessage("You're in. Confirming your subscription...");
    await new Promise(r => setTimeout(r, 2500));
    await updateSession();
    setStatus('success');
    setMessage("You're in. Welcome to the real thing.");
    setTimeout(() => router.push('/'), 2000);
  };

  const handlePaystack = async () => {
    setMessage('Verifying your payment...');
    let reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference && typeof window !== 'undefined') {
      reference = sessionStorage.getItem('paystack_reference');
      if (reference) sessionStorage.removeItem('paystack_reference');
    }

    if (!reference) {
      setStatus('error');
      setMessage('Invalid payment reference.');
      return;
    }

    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();

      if (data.success) {
        await updateSession();
        setStatus('success');
        setMessage(`You're on ${data.plan} now. Let's go.`);
        setTimeout(() => router.push('/'), 2500);
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Payment verification failed.');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to verify payment. If you were charged, contact support.');
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>

        {status === 'verifying' && (
          <>
            <div style={s.iconWrap}>
              <div style={s.spinner} />
            </div>
            <h2 style={s.title}>{message || 'One sec...'}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={s.iconWrap}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 style={s.title}>{message}</h2>
            <p style={s.sub}>Taking you back...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={s.iconWrap}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h2 style={s.title}>Something went wrong.</h2>
            <p style={s.sub}>{message}</p>
            <button onClick={() => router.push('/')} style={s.btn}>Go back</button>
          </>
        )}

      </div>
    </div>
  );
}

export default function PaymentCallback() {
  return (
    <Suspense fallback={
      <div style={s.container}>
        <div style={s.card}>
          <div style={s.iconWrap}><div style={s.spinner} /></div>
          <h2 style={s.title}>One sec...</h2>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0C0C0E',
    padding: '24px',
  },
  card: {
    maxWidth: '420px',
    width: '100%',
    padding: '48px 36px',
    background: '#111114',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#E8A04C',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#F0EDE8',
    margin: '0 0 8px',
    letterSpacing: '-0.03em',
  },
  sub: {
    fontSize: '14px',
    color: '#7A7680',
    margin: '0 0 24px',
  },
  btn: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#0C0C0E',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
