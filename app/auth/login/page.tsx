import { AuthView } from '@neondatabase/auth/react/ui';

export default function SignInPage() {
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
