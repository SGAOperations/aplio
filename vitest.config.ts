import 'dotenv/config';

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootAlias = { '@': fileURLToPath(new URL('.', import.meta.url)) };

export default defineConfig({
  resolve: { alias: rootAlias },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            'server-only': fileURLToPath(
              new URL('./tests/stubs/server-only.ts', import.meta.url),
            ),
            ...rootAlias,
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          // Deliberately not the org timezone — any accidental host-zone
          // dependence in lib/dates.ts fails loudly instead of passing by luck.
          env: { TZ: 'Asia/Tokyo' },
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: {
          // More specific aliases first — Vite matches in order, and '@' would
          // otherwise shadow '@/lib/auth/server' as a prefix match.
          alias: {
            '@/lib/auth/server': fileURLToPath(
              new URL('./tests/stubs/auth-server.ts', import.meta.url),
            ),
            'next/cache': fileURLToPath(
              new URL('./tests/stubs/next-cache.ts', import.meta.url),
            ),
            'server-only': fileURLToPath(
              new URL('./tests/stubs/server-only.ts', import.meta.url),
            ),
            ...rootAlias,
          },
        },
        test: {
          name: 'db',
          environment: 'node',
          env: { TZ: 'America/New_York' },
          include: ['tests/db/**/*.test.ts'],
          globalSetup: ['tests/global-setup.ts'],
          // One database, no cross-file interleaving.
          fileParallelism: false,
        },
      },
    ],
  },
});
