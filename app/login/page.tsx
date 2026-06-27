import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthView } from '@neondatabase/auth/react/ui';

import { getOptionalUser } from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

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

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AuthView
        path="SIGN_IN"
        redirectTo={safeTo}
        classNames={{
          base: 'max-w-xl',
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
