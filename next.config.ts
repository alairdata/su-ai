import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable instrumentation hook for Sentry (when available)
  experimental: {
    instrumentationHook: true,
  },
};

// Try to load Sentry - make it optional so build works without it
let finalConfig: NextConfig = nextConfig;

try {
  // Only wrap with Sentry if the module is available
  const { withSentryConfig } = require("@sentry/nextjs");

  const sentryWebpackPluginOptions = {
    // Suppresses source map uploading logs during build
    silent: true,

    // Upload source maps to Sentry for better error traces
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only upload source maps in production
    disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
    disableClientWebpackPlugin: process.env.NODE_ENV !== "production",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  };

  finalConfig = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
  console.log("Sentry integration enabled");
} catch {
  // Sentry not installed - continue without it
  console.log("Sentry not installed, continuing without error tracking");
}

export default finalConfig;
