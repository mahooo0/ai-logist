import type { NextConfig } from 'next';

// Merged with Zenith template (next.config.mjs) — preserves Phase 1 `output: 'standalone'`
// for Docker layered on top of Zenith's reactCompiler + console-removal + /dashboard redirect.
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/default',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
