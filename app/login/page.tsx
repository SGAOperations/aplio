import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthView } from '@neondatabase/auth/react/ui';

import { getOptionalUser } from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

import { NameField } from '@/components/features/name-field';

export const metadata: Metadata = { title: 'Sign In' };

// Constrain redirectTo to a same-origin relative path — accept only values
// starting with a single "/" and not "//" to prevent open-redirect attacks.
function safeRedirectTo(value: string | undefined): string {
  if (value && /^\/(?!\/)/.test(value)) return value;
  return '/positions';
}

// When the destination is an application form, hide all sign-in / account
// creation language so applicants only see copy about submitting an application.
function isApplyRedirect(value: string): boolean {
  return /^\/positions\/[^/]+\/apply/.test(value);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { redirectTo } = await searchParams;
  const safeTo = safeRedirectTo(redirectTo);
  const applyContext = isApplyRedirect(safeTo);

  const user = await getOptionalUser();
  // Authenticated user with a name set — send them into the app.
  if (user?.name?.trim()) redirect(safeTo);
  // Authenticated user with no name — fall through to render the name form below.

  const isDev = process.env.VERCEL_ENV !== 'production';

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {user ? (
        <NameField defaultName={user.name ?? ''} redirectTo={safeTo} />
      ) : (
        <AuthView
          path="SIGN_IN"
          redirectTo={safeTo}
          classNames={{
            base: 'w-full',
            content: 'w-full',
            form: { base: 'w-full', otpInputContainer: 'justify-center' },
          }}
          localization={
            applyContext
              ? {
                  SIGN_IN: 'Continue Your Application',
                  SIGN_IN_DESCRIPTION:
                    "Enter your email to continue your application. We'll send you a one-time code.",
                  SIGN_IN_ACTION: 'Continue',
                  EMAIL_OTP: '',
                  EMAIL_OTP_DESCRIPTION:
                    'Enter your email to continue your application.',
                  SIGN_UP: 'Continue Your Application',
                  SIGN_UP_ACTION: 'Continue',
                  SIGN_UP_DESCRIPTION:
                    "Enter your email to continue your application. We'll send you a one-time code.",
                }
              : {
                  SIGN_IN_DESCRIPTION:
                    "Enter your email to sign in or create an account. We'll send you a one-time code.",
                  EMAIL_OTP: '',
                }
          }
        />
      )}
      {isDev && (
        <p className="text-muted-foreground text-center text-xs">
          Dev:{' '}
          <Link href="/login/bypass" className="underline">
            switch user via bypass login
          </Link>
        </p>
      )}
      <p className="text-muted-foreground text-center text-xs">
        By creating an account, you agree to our{' '}
        <Link href={TERMS_HREF} className="text-primary hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href={PRIVACY_HREF} className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
