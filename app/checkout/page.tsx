'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

const PLAN_CONFIG = {
  Pro: {
    priceUSD: 4.99,
    name: 'Pro',
    tagline: 'For people who actually use it.',
    features: [
      '100 messages a day',
      'Memory that carries across conversations',
      'Longer context — it remembers more of your chat',
      'Early access to new features',
    ],
  },
  Plus: {
    priceUSD: 9.99,
    name: 'Plus',
    tagline: 'For people who are serious.',
    features: [
      '300 messages a day',
      'Everything in Pro',
      'Priority access when traffic is high',
      'First in line for new models and features',
    ],
  },
};

type PaidPlan = 'Pro' | 'Plus';

const BoltLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <defs>
      <linearGradient id="boltGradCO" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8A04C" />
        <stop offset="100%" stopColor="#E8624C" />
      </linearGradient>
    </defs>
    <path d="M35 4L12 34h14l-4 22L48 26H34l4-22z" fill="url(#boltGradCO)" />
  </svg>
);

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutLoading() {
  return (
    <div style={s.container}>
      <div style={s.spinner} />
    </div>
  );
}

function CheckoutContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planParam = searchParams.get('plan') as PaidPlan | null;
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>(planParam || 'Pro');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = PLAN_CONFIG[selectedPlan];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/?login=true');
    }
  }, [status, router]);

  useEffect(() => {
    const userPlan = session?.user?.plan;
    if (!userPlan) return;
    if (userPlan === 'Plus') router.push('/');
    if (userPlan === 'Pro' && selectedPlan === 'Pro') router.push('/');
  }, [session, router, selectedPlan]);

  const handlePayment = async () => {
    if (!session?.user?.email) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to initialize payment');
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setIsLoading(false);
    }
  };

  if (status === 'loading') return <CheckoutLoading />;
  if (!session?.user) return null;

  return (
    <div style={s.container}>
      <div style={s.card}>

        {/* Back */}
        <button onClick={() => router.push('/')} style={s.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        {/* Header */}
        <div style={s.header}>
          <BoltLogo size={36} />
          <div>
            <h1 style={s.title}>Unlock the full thing.</h1>
            <p style={s.subtitle}>No fluff. Just more of what you came here for.</p>
          </div>
        </div>

        {/* Plan Tabs */}
        <div style={s.tabs}>
          {(['Pro', 'Plus'] as PaidPlan[]).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPlan(p)}
              style={{
                ...s.tab,
                ...(selectedPlan === p ? s.tabActive : {}),
              }}
            >
              <span style={{ fontWeight: 700 }}>{p}</span>
              <span style={{ fontSize: '13px', opacity: 0.7 }}>${PLAN_CONFIG[p].priceUSD}/mo</span>
            </button>
          ))}
        </div>

        {/* Plan Detail */}
        <div style={s.planBox}>
          <div style={s.priceRow}>
            <span style={s.price}>${plan.priceUSD}</span>
            <span style={s.period}>/month</span>
          </div>
          <p style={s.tagline}>{plan.tagline}</p>

          <div style={s.featureList}>
            {plan.features.map((f, i) => (
              <div key={i} style={s.featureRow}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div style={s.error}>{error}</div>}

        {/* CTA */}
        <button
          onClick={handlePayment}
          disabled={isLoading}
          style={{ ...s.ctaBtn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? (
            <><div style={s.btnSpinner} /> Processing...</>
          ) : (
            `Get ${plan.name} — $${plan.priceUSD}/mo`
          )}
        </button>

        {/* Footer notes */}
        <p style={s.note}>Cancel anytime. No questions asked.</p>
        <p style={s.noteSmall}>Payment is processed securely. The charge will appear in your local currency.</p>

        <div style={s.userRow}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A7680" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{session.user.email}</span>
        </div>
      </div>
    </div>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#0C0C0E',
  },
  card: {
    background: '#111114',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '32px 28px',
    maxWidth: '460px',
    width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: '#7A7680',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0',
    marginBottom: '24px',
    transition: 'color 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '28px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#F0EDE8',
    margin: '0 0 4px',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8A8690',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    background: '#18181C',
    padding: '4px',
    borderRadius: '14px',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: '#7A7680',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#1E1E24',
    color: '#F0EDE8',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  planBox: {
    background: '#18181C',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    marginBottom: '6px',
  },
  price: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#F0EDE8',
    letterSpacing: '-0.04em',
    lineHeight: 1,
  },
  period: {
    fontSize: '16px',
    color: '#7A7680',
  },
  tagline: {
    fontSize: '13px',
    color: '#8A8690',
    margin: '0 0 20px',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: '#C8C4CC',
  },
  error: {
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.2)',
    color: '#fca5a5',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  ctaBtn: {
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#0C0C0E',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    letterSpacing: '-0.01em',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0,0,0,0.2)',
    borderTopColor: '#0C0C0E',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  note: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#7A7680',
    margin: '14px 0 4px',
  },
  noteSmall: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#4A4650',
    margin: '0 0 16px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: '13px',
    color: '#7A7680',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#E8A04C',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
