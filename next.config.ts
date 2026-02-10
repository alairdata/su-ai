import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SECURITY: Limit request body size to prevent memory exhaustion attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
  // Bake the build ID into the client bundle so we can detect stale versions
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || '20260210c',
  },
};

export default nextConfig;
