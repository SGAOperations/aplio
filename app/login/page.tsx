import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getOptionalUser } from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

import { LoginView } from '@/components/features/login-view';

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
  if (user) redirect(safeTo);

  const isDev = process.env.VERCEL_ENV !== 'production';

  const copy = applyContext
    ? {
        title: 'Continue Your Application',
        description:
          "Enter your email to continue your application. We'll send you a one-time code.",
        sentDescription:
          'Check your inbox for a one-time code to continue your application.',
      }
    : {
        title: 'Sign in',
        description:
          "Enter your email to sign in or create an account. We'll send you a one-time code.",
        sentDescription: 'Check your inbox for a one-time code.',
      };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <LoginView redirectTo={safeTo} copy={copy} />
      {isDev && (
        <p className="text-muted-foreground text-center text-xs">
          Dev:{' '}
          <Link href="/login/bypass" className="underline">
            switch user via bypass login
          </Link>
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        <Link
          href={PRIVACY_HREF}
          className="hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        {' · '}
        <Link
          href={TERMS_HREF}
          className="hover:text-foreground hover:underline"
        >
          Terms of Service
        </Link>
      </p>
    </div>
  );
}
