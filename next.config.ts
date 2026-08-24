import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'court-auction-notice-search',
    'k-skill-browser-runtime',
    'playwright-core',
    'rebrowser-playwright',
  ],
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/oauth-authorization-server',
      },
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/oauth-protected-resource',
      },
    ];
  },
};

export default nextConfig;
