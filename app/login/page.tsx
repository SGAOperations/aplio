import { redirect } from 'next/navigation';

import { AuthView } from '@neondatabase/auth/react/ui';

import { getOptionalUser } from '@/lib/auth/server';

// Auto-forward only when the user has both a valid auth session and an active
// app User row. Deactivated users and provisioning gaps stay on /login.
export default async function SignInPage() {
  const user = await getOptionalUser();
  if (user) redirect('/');

  return (
    <AuthView
      path="SIGN_IN"
      classNames={{ form: { otpInputContainer: 'justify-center' } }}
      localization={{
        SIGN_IN_DESCRIPTION:
          'Enter your email to receive a one-time sign-in code',
        EMAIL_OTP: '',
      }}
    />
  );
}
