// Sentry client configuration - only runs if @sentry/nextjs is installed
try {
  const Sentry = require("@sentry/nextjs");

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring

    // Session Replay for debugging
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors

    // Set environment
    environment: process.env.NODE_ENV,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      "ResizeObserver loop",
      "ResizeObserver loop limit exceeded",
      // Network errors users can't control
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      // User-initiated navigation
      "AbortError",
    ],
  });
} catch {
  // Sentry not installed - continue without it
}
