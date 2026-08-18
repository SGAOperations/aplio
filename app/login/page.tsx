import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { safeRedirectTo, withRedirectTo } from '@/lib/auth/redirect';
import { getOptionalUser } from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';
import { isBypassAllowed } from '@/lib/utils';

import { LoginView } from '@/components/features/login-view';
import { NameField } from '@/components/features/name-field';

export const metadata: Metadata = { title: 'Sign In' };

// Applying: hide sign-in language, show only application copy.
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

  // Must match isBypassAllowed, so the affordance and the action agree.
  const isDev = isBypassAllowed();

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
      {user ? (
        <NameField defaultName={user.name ?? ''} redirectTo={safeTo} />
      ) : (
        <LoginView copy={copy} />
      )}
      {isDev && (
        <p className="text-muted-foreground text-center text-xs">
          Dev:{' '}
          <Link
            href={withRedirectTo('/login/bypass', safeTo)}
            className="underline"
          >
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
