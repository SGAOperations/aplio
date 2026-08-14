import type { NextConfig } from 'next';

import config from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
  env: { version: config.version },
  // Clears the 4MB file cap without passing Vercel's hard 4.5MB ceiling.
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
