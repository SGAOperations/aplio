import 'server-only';

import { nextCookies } from 'better-auth/next-js';

import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';

import { buildOtpSignInUrl } from '@/lib/auth/otp-link';
import { getBaseUrl } from '@/lib/base-url';
import { ACCOUNT_DEACTIVATED_ERROR_CODE } from '@/lib/constants';
import { sendEmail } from '@/lib/email/resend';
import { otpEmail } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';

const OTP_EXPIRY_SECONDS = 300;

function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');
  return secret;
}

// Never a `*.vercel.app` wildcard — that would trust every Vercel account's deployments.
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
  baseURL: getBaseUrl(),
  secret: requireSecret(),
  trustedOrigins: resolveTrustedOrigins(),
  // Our ids are uuid(7) from Prisma defaults; letting Better Auth generate them
  // would mix formats across the User table's existing foreign keys.
  advanced: { database: { generateId: false } },
  // Enabled explicitly to cover preview, not just production; keys are
  // route-relative since Better Auth strips the /api/auth base path.
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
        // Throws — returning false leaves callers dereferencing a null session's .token.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true },
          });
          if (user?.deletedAt)
            throw APIError.from('FORBIDDEN', {
              code: ACCOUNT_DEACTIVATED_ERROR_CODE,
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
          signInUrl: buildOtpSignInUrl(getBaseUrl(), email, otp),
          expiresInMinutes: OTP_EXPIRY_SECONDS / 60,
        });
        await sendEmail({ to: email, ...template });
      },
    }),
    // Must stay last: it writes cookies for the handlers registered before it.
    nextCookies(),
  ],
});
