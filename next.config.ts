import type { NextConfig } from 'next';

import config from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
  env: { version: config.version },
  // Raised from the 1MB default to clear the 4MB file cap, and no higher than
  // Vercel's hard 4.5MB Function body ceiling.
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
