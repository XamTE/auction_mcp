import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/mcp': [
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  serverExternalPackages: [
    '@sparticuz/chromium',
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
