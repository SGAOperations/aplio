import 'server-only';

import { nextCookies } from 'better-auth/next-js';

import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
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

// Never a `*.vercel.app` wildcard — any Vercel account can deploy to that
// suffix, which would make every one of them a trusted origin. Vercel sets
// both hosts itself, so preview deployments stay covered.
function resolveTrustedOrigins(): string[] {
  const origins = [
    'http://localhost:3000',
    'https://apply.northeasternsga.com',
  ];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL])
    if (host) origins.push(`https://${host}`);
  return origins;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: resolveBaseUrl(),
  secret: requireSecret(),
  trustedOrigins: resolveTrustedOrigins(),
  // Our ids are uuid(7) from Prisma defaults; letting Better Auth generate them
  // would mix formats across the User table's existing foreign keys.
  advanced: { database: { generateId: false } },
  // Enabled explicitly: the default only covers production, leaving the OTP
  // endpoints unlimited on preview. Complements proxy.ts, which limits the
  // whole /api/ prefix per IP but can't single out these two routes.
  // Keys are route-relative — Better Auth strips the /api/auth base path
  // before matching, so a prefixed key would silently never match.
  rateLimit: {
    enabled: true,
    customRules: {
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      '/sign-in/email-otp': { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Denies deactivated accounts a session across every sign-in path.
        // Throws instead of returning false: an aborted create resolves to a
        // null session that the sign-in routes dereference for `.token`,
        // surfacing as a 500 rather than a refusal.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true },
          });
          if (user?.deletedAt)
            throw APIError.from('FORBIDDEN', {
              code: 'ACCOUNT_DEACTIVATED',
              message: 'This account has been deactivated.',
            });
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      allowedAttempts: 3,
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
