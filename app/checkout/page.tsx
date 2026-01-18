"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Plan configuration (must match server)
const PLAN_CONFIG = {
  Pro: {
    priceUSD: 4.99,
    name: 'Pro Plan',
    description: 'Monthly subscription',
    features: [
      '150 messages per day',
      'Priority support',
      'Advanced AI responses',
      'Cancel anytime',
    ],
  },
  Plus: {
    priceUSD: 9.99,
    name: 'Plus Plan',
    description: 'Monthly subscription',
    features: [
      '400 messages per day',
      '24/7 priority support',
      'Advanced AI responses',
      'Early access to new features',
      'Cancel anytime',
    ],
  },
};

type PlanType = keyof typeof PLAN_CONFIG;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();

  const planParam = searchParams.get('plan') as PlanType | null;
  const plan = planParam && PLAN_CONFIG[planParam] ? planParam : 'Pro';
  const planDetails = PLAN_CONFIG[plan];

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile'>('card');
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardName: '',
    country: 'US',
    zipCode: '',
    mobileProvider: '',
    phoneNumber: '',
  });
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'otp' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [otp, setOtp] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!session?.user) {
      router.push('/');
    }
  }, [session, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cardNumber') {
      formattedValue = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
    } else if (name === 'expiry') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);
    } else if (name === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async () => {
    setProcessing(true);
    setStatus('processing');
    setMessage('Processing your payment...');

    try {
      const payload: Record<string, unknown> = {
        plan,
        paymentMethod,
      };

      if (paymentMethod === 'card') {
        payload.card = {
          number: formData.cardNumber,
          expiry: formData.expiry,
          cvv: formData.cvv,
        };
      } else {
        payload.mobileMoney = {
          phone: formData.phoneNumber,
          provider: formData.mobileProvider,
        };
      }

      const res = await fetch('/api/payment/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage('Payment successful! Redirecting...');
        await updateSession();
        setTimeout(() => router.push('/'), 2000);
      } else if (data.status === 'send_otp') {
        setStatus('otp');
        setMessage(data.message);
        setReference(data.reference);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setMessage(data.message);
        setReference(data.reference);
        // Start polling for mobile money
        pollPaymentStatus(data.reference);
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Payment failed');
      }
    } catch {
      setStatus('error');
      setMessage('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleOTPSubmit = async () => {
    setProcessing(true);
    setMessage('Verifying OTP...');

    try {
      const res = await fetch('/api/payment/submit-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, otp }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage('Payment successful! Redirecting...');
        await updateSession();
        setTimeout(() => router.push('/'), 2000);
      } else {
        setMessage(data.message || 'OTP verification failed');
      }
    } catch {
      setMessage('OTP verification failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const pollPaymentStatus = async (ref: string) => {
    // Poll every 5 seconds for mobile money confirmation
    const maxAttempts = 24; // 2 minutes total
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStatus('error');
        setMessage('Payment timeout. Please check your phone and try again.');
        return;
      }

      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: ref }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setMessage('Payment successful! Redirecting...');
          await updateSession();
          setTimeout(() => router.push('/'), 2000);
          return;
        }
      } catch {
        // Continue polling
      }

      attempts++;
      setTimeout(poll, 5000);
    };

    setTimeout(poll, 5000);
  };

  // Success screen
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-black">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">{message}</p>
        </div>
      </div>
    );
  }

  // OTP screen
  if (status === 'otp') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-2 border-black">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Enter OTP</h2>
          <p className="text-gray-600 mb-6 text-center">{message}</p>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter OTP"
            className="w-full px-4 py-3 border-2 border-black rounded-lg mb-4 text-center text-2xl tracking-widest"
            maxLength={6}
          />
          <button
            onClick={handleOTPSubmit}
            disabled={processing || otp.length < 4}
            className="w-full bg-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {processing ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>
      </div>
    );
  }

  // Pending screen (mobile money)
  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-black">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Confirmation</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <p className="text-sm text-gray-500">Please approve the payment prompt on your phone.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">So Unfiltered AI</h1>
          <p className="text-gray-600">Secure Checkout</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-black h-fit">
            <h2 className="text-2xl font-bold text-black mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-gray-700">
                <span>{planDetails.name} - Monthly</span>
                <span className="font-semibold">${planDetails.priceUSD.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-300 pt-4 flex justify-between text-black text-xl font-bold">
                <span>Total</span>
                <span>${planDetails.priceUSD.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-gray-100 border-2 border-black rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-black mb-2">Plan Includes:</h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                {planDetails.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-4 h-4 mr-2 mt-0.5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-center text-gray-600 text-sm mb-3">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secured by 256-bit SSL encryption</span>
            </div>

            <div className="text-center text-xs text-gray-500 pt-3 border-t border-gray-200">
              Your payment is processed securely. Card details are never stored on our servers.
            </div>
          </div>

          {/* Payment Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-black">
            <div className="space-y-6">
              {/* Email (from session) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={session?.user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition ${
                      paymentMethod === 'card'
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span className="font-medium">Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition ${
                      paymentMethod === 'mobile'
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">Mobile Money</span>
                  </button>
                </div>
              </div>

              {/* Card Payment Fields */}
              {paymentMethod === 'card' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Information
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={handleChange}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-4 py-3 border-2 border-black rounded-t-lg focus:ring-2 focus:ring-gray-400 outline-none"
                      />
                      <svg className="absolute right-3 top-3 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-2">
                      <input
                        type="text"
                        name="expiry"
                        value={formData.expiry}
                        onChange={handleChange}
                        placeholder="MM/YY"
                        className="px-4 py-3 border-2 border-t-0 border-r-0 border-black rounded-bl-lg focus:ring-2 focus:ring-gray-400 outline-none"
                      />
                      <input
                        type="text"
                        name="cvv"
                        value={formData.cvv}
                        onChange={handleChange}
                        placeholder="CVV"
                        className="px-4 py-3 border-2 border-t-0 border-black rounded-br-lg focus:ring-2 focus:ring-gray-400 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      name="cardName"
                      value={formData.cardName}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-gray-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country
                      </label>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-gray-400 outline-none bg-white"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="GH">Ghana</option>
                        <option value="NG">Nigeria</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        placeholder="10001"
                        className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-gray-400 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Money Fields */}
              {paymentMethod === 'mobile' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Money Provider
                    </label>
                    <select
                      name="mobileProvider"
                      value={formData.mobileProvider}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-gray-400 outline-none bg-white"
                    >
                      <option value="">Select provider</option>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="vodafone">Vodafone Cash</option>
                      <option value="airteltigo">AirtelTigo Money</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="0XX XXX XXXX"
                      className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-gray-400 outline-none"
                    />
                  </div>

                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      You will receive a prompt on your phone to authorize this payment.
                    </p>
                  </div>
                </>
              )}

              {/* Error message */}
              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-600">{message}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={processing}
                className="w-full bg-black text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pay ${planDetails.priceUSD.toFixed(2)}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                By confirming your subscription, you allow So Unfiltered AI to charge your payment method for this payment and future payments in accordance with our terms.
              </p>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full text-gray-600 py-2 text-sm hover:text-black transition"
              >
                ← Back to home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
