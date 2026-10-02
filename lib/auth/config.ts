import 'server-only';

import { nextCookies } from 'better-auth/next-js';

import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, genericOAuth, slack } from 'better-auth/plugins';

import { buildOtpSignInUrl } from '@/lib/auth/otp-link';
import {
  assertSessionUserActive,
  recordSignIn,
} from '@/lib/auth/session-hooks';
import { completeSlackLink, validateSlackLink } from '@/lib/auth/slack-link';
import { getBaseUrl } from '@/lib/base-url';
import { SLACK_PROVIDER_ID } from '@/lib/constants';
import { sendEmail } from '@/lib/email/resend';
import { otpEmail } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { SlackApiError, getOpenIdUserInfo } from '@/lib/slack/client';
import { isSlackConfigured, requireSlackEnv } from '@/lib/slack/config';

const OTP_EXPIRY_SECONDS = 600;

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
  // The Slack email may differ from the Aplio email, so email-based implicit
  // linking is never what connects it — only an authenticated linkSocial call.
  account: {
    accountLinking: {
      allowDifferentEmails: true,
      trustedProviders: [SLACK_PROVIDER_ID],
      disableImplicitLinking: true,
    },
  },
  user: { validateUserInfo: validateSlackLink },
  databaseHooks: {
    user: {
      create: {
        // Better Auth's email-otp flow writes name: "" for a first-time
        // signup with no name; store NULL so it's not a "real" blank name.
        before: async (user) => ({
          data: { name: user.name.trim() || undefined },
        }),
      },
    },
    session: {
      create: {
        before: async (session) => {
          await assertSessionUserActive(session.userId);
        },
        // A blocked (before-thrown) sign-in never reaches after, so this only
        // stamps committed sessions.
        after: async (session) => {
          await recordSignIn(session.userId);
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          await completeSlackLink(account);
        },
      },
    },
  },
  // Slack can only ever be linked to an existing session, never used to sign in.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === '/sign-in/social' &&
        (ctx.body as { provider?: string } | undefined)?.provider ===
          SLACK_PROVIDER_ID
      )
        throw new APIError('FORBIDDEN');
    }),
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp }) {
        const emailContent = otpEmail({
          code: otp,
          signInUrl: buildOtpSignInUrl(getBaseUrl(), email, otp),
          expiresInMinutes: OTP_EXPIRY_SECONDS / 60,
        });
        await sendEmail({ to: email, ...emailContent, template: 'otp' });
      },
    }),
    ...(isSlackConfigured()
      ? [
          genericOAuth({
            config: [
              {
                ...slack({
                  clientId: requireSlackEnv('SLACK_CLIENT_ID'),
                  clientSecret: requireSlackEnv('SLACK_CLIENT_SECRET'),
                }),
                // The stock Slack helper's getUserInfo drops the team claim;
                // this one keeps it for validateSlackLink to check.
                getUserInfo: async (tokens) => {
                  if (!tokens.accessToken) return null;
                  try {
                    return await getOpenIdUserInfo(tokens.accessToken);
                  } catch (err) {
                    console.error(
                      'Slack getUserInfo failed',
                      err instanceof SlackApiError ? err.code : err,
                    );
                    return null;
                  }
                },
                disableSignUp: true,
              },
            ],
          }),
        ]
      : []),
    // Must stay last: it writes cookies for the handlers registered before it.
    nextCookies(),
  ],
});
