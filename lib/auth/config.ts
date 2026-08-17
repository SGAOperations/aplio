import 'server-only';

import { nextCookies } from 'better-auth/next-js';

import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

import { sendEmail } from '@/lib/email/resend';
import { otpEmail } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';

const OTP_EXPIRY_SECONDS = 300;

// Pinned in production because a wrong origin on the custom domain fails silently;
// derived elsewhere since VERCEL_URL changes every deployment.
function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');
  return secret;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: resolveBaseUrl(),
  secret: requireSecret(),
  // Wildcard covers per-deployment preview hosts, which can't be enumerated.
  trustedOrigins: [
    'http://localhost:3000',
    'https://apply.northeasternsga.com',
    'https://*.vercel.app',
  ],
  // Our ids are uuid(7) from Prisma defaults; letting Better Auth generate them
  // would mix formats across the User table's existing foreign keys.
  advanced: { database: { generateId: false } },
  // Ours already runs in proxy.ts; two limiters would double-count the same IP.
  rateLimit: { enabled: false },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      async sendVerificationOTP({ email, otp }) {
        const template = otpEmail({
          code: otp,
          expiresInMinutes: OTP_EXPIRY_SECONDS / 60,
        });
        await sendEmail({ to: email, ...template });
      },
    }),
    // Must stay last: it writes cookies for the handlers registered before it.
    nextCookies(),
  ],
});
