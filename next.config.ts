import type { NextConfig } from 'next';

import { buildSecurityHeaders } from './lib/security-headers';
import config from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
  env: { version: config.version },
  // Clears the 4MB file cap without passing Vercel's hard 4.5MB ceiling.
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
