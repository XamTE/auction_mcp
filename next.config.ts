import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'court-auction-notice-search',
    'k-skill-browser-runtime',
    'playwright-core',
    'rebrowser-playwright',
  ],
};

export default nextConfig;
