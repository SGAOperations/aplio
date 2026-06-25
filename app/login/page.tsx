import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthView } from '@neondatabase/auth/react/ui';

import { getOptionalUser } from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

// Auto-forward only when the user has both a valid auth session and an active
// app User row. Deactivated users and provisioning gaps stay on /login.
export default async function SignInPage() {
  const user = await getOptionalUser();
  if (user) redirect('/');

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AuthView
        path="SIGN_IN"
        classNames={{ form: { otpInputContainer: 'justify-center' } }}
        localization={{
          SIGN_IN_DESCRIPTION:
            'Enter your email to receive a one-time sign-in code',
          EMAIL_OTP: '',
        }}
      />
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
