'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';

// Plan configuration (must match server-side)
const PLAN_CONFIG = {
  Pro: {
    priceUSD: 0.99,
    name: 'Pro Plan',
    features: [
      '100 messages per day',
      '10x more than Free',
      'Expanded memory and context',
      'Early access to new features',
      'Advanced reasoning models',
      'Memory across conversations',
    ],
  },
  Plus: {
    priceUSD: 9.99,
    name: 'Plus Plan',
    features: [
      'Everything in Pro',
      '300 messages per day',
      '30x more than Free, 3x more than Pro',
      'Higher outputs for more tasks',
      'Priority access at high traffic',
      'Early access to advanced features',
    ],
  },
};

type PaidPlan = 'Pro' | 'Plus';

// Declare Paystack types
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

// Wrapper component to handle Suspense for useSearchParams
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutLoading() {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.spinner} />
      <p>Loading...</p>
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
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  const plan = PLAN_CONFIG[selectedPlan];

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/?login=true');
    }
  }, [status, router]);

  // Redirect if already on a paid plan
  useEffect(() => {
    if (session?.user?.plan && session.user.plan !== 'Free') {
      router.push('/');
    }
  }, [session, router]);

  const handlePayment = async () => {
    if (!session?.user?.email || !paystackLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize transaction on server
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Open Paystack popup
      const handler = window.PaystackPop.setup({
        key: data.public_key,
        email: session.user.email,
        amount: data.amount, // Amount in pesewas
        currency: 'GHS',
        ref: data.reference,
        metadata: {
          userId: session.user.id,
          plan: selectedPlan,
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan",
              value: selectedPlan
            }
          ]
        },
        callback: async (response) => {
          // Verify payment on server
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: response.reference }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              // Redirect to success page or home
              router.push('/?subscribed=true');
            } else {
              setError(verifyData.message || 'Payment verification failed');
            }
          } catch (err) {
            setError('Failed to verify payment. Please contact support.');
          }
          setIsLoading(false);
        },
        onClose: () => {
          setIsLoading(false);
        },
      });

      handler.openIframe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <>
      <Script
        src="https://js.paystack.co/v1/inline.js"
        onLoad={() => setPaystackLoaded(true)}
      />

      <div style={styles.container}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <button onClick={() => router.push('/')} style={styles.backButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>
            <h1 style={styles.title}>Subscribe to So UnFiltered AI</h1>
          </div>

          {/* Plan Selector */}
          <div style={styles.planSelector}>
            <button
              onClick={() => setSelectedPlan('Pro')}
              style={{
                ...styles.planTab,
                ...(selectedPlan === 'Pro' ? styles.planTabActive : {}),
              }}
            >
              Pro - $0.99/mo
            </button>
            <button
              onClick={() => setSelectedPlan('Plus')}
              style={{
                ...styles.planTab,
                ...(selectedPlan === 'Plus' ? styles.planTabActive : {}),
              }}
            >
              Plus - $9.99/mo
            </button>
          </div>

          {/* Plan Details */}
          <div style={styles.planDetails}>
            <div style={styles.priceSection}>
              <span style={styles.price}>${plan.priceUSD}</span>
              <span style={styles.period}>/month</span>
            </div>

            <ul style={styles.features}>
              {plan.features.map((feature, index) => (
                <li key={index} style={styles.feature}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {/* Subscribe Button */}
          <button
            onClick={handlePayment}
            disabled={isLoading || !paystackLoaded}
            style={{
              ...styles.subscribeButton,
              opacity: isLoading || !paystackLoaded ? 0.7 : 1,
              cursor: isLoading || !paystackLoaded ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <>
                <div style={styles.buttonSpinner} />
                Processing...
              </>
            ) : (
              `Subscribe to ${selectedPlan} - $${plan.priceUSD}/mo`
            )}
          </button>

          {/* Info Note */}
          <p style={styles.note}>
            Secure payment powered by Paystack. Cancel anytime.
          </p>

          {/* User Info */}
          <div style={styles.userInfo}>
            <span>Subscribing as:</span>
            <strong>{session.user.email}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #f8f5ef 0%, #f0ebe3 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  header: {
    marginBottom: '24px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
  },
  planSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    background: '#f5f5f5',
    padding: '4px',
    borderRadius: '10px',
  },
  planTab: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#666',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  planTabActive: {
    background: '#fff',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  planDetails: {
    marginBottom: '24px',
  },
  priceSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    marginBottom: '20px',
  },
  price: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  period: {
    fontSize: '18px',
    color: '#666',
  },
  features: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    color: '#444',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  subscribeButton: {
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  buttonSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  note: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#888',
    marginTop: '16px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
    fontSize: '14px',
    color: '#666',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    background: 'linear-gradient(135deg, #f8f5ef 0%, #f0ebe3 100%)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#667eea',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
