import type { NextConfig } from 'next';

import config from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
  env: { version: config.version },
  // File-upload questions post through a Server Action (no Route Handler
  // allowed in this repo). Default body limit is 1MB; raise it to comfortably
  // cover the app's 4MB file cap while staying under Vercel's hard 4.5MB
  // Function body ceiling (see lib/constants.ts FILE_UPLOAD_MAX_BYTES).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
