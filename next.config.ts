import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Allow large request bodies for VPS proxy routes
  serverExternalPackages: [],
};

export default nextConfig;
