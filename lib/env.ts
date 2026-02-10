/**
 * Environment variable validation
 * Validates required env vars at startup to fail fast with clear errors
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const;

const optionalEnvVars = [
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_PLUS_PRICE_ID',
  'RESEND_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'VIP_EMAILS',
] as const;

/**
 * Validate that all required environment variables are set
 * Call this at app startup
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env.local file');
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Check if a specific feature's env vars are configured
 */
export function isFeatureConfigured(feature: 'stripe' | 'email' | 'google' | 'github' | 'ai'): boolean {
  switch (feature) {
    case 'stripe':
      return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
    case 'email':
      return !!process.env.RESEND_API_KEY;
    case 'google':
      return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case 'github':
      return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    case 'ai':
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

/**
 * Sanitize error messages for client responses
 * Prevents leaking internal error details
 */
export function sanitizeErrorForClient(error: unknown): string {
  // Log full error server-side for debugging
  console.error('Server error:', error);

  // Return generic message to client
  // Never expose internal error details
  if (error instanceof Error) {
    // Check for known safe errors we can expose
    const safeErrors = [
      'Unauthorized',
      'Not found',
      'Invalid input',
      'Rate limit exceeded',
      'Daily message limit reached',
      'Invalid plan',
      'Chat not found',
      'User not found',
      'Missing price ID',
      'STRIPE_',
      'Stripe',
      'Exchange rate',
      'Paystack',
      'Payment',
      'Please try again',
      'Cannot downgrade',
      'already have',
    ];

    for (const safeError of safeErrors) {
      if (error.message.includes(safeError)) {
        return error.message;
      }
    }
  }

  // Generic error for everything else
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Safe error response helper
 */
export function safeErrorResponse(error: unknown, status = 500) {
  return {
    error: sanitizeErrorForClient(error),
    status,
  };
}
