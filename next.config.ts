import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SECURITY: Limit request body size to prevent memory exhaustion attacks
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
};

export default nextConfig;
