import { AuthView } from '@neondatabase/auth/react/ui';

export default function SignInPage() {
  return (
    <AuthView
      path="SIGN_IN"
      classNames={{ form: { otpInputContainer: 'justify-center' } }}
    />
  );
}
