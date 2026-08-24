'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';

import { checkSignInAllowed, isOtpResendAllowed } from '@/prisma/actions/auth';

import { authClient } from '@/lib/auth/client';
import {
  getErrorCode,
  getOtpSendErrorMessage,
  getOtpVerifyErrorMessage,
} from '@/lib/auth/errors';
import type { OtpLinkParams } from '@/lib/auth/otp-link';
import { strippedOtpLinkHref } from '@/lib/auth/otp-link';
import {
  ACCOUNT_DEACTIVATED_ERROR_CODE,
  ACCOUNT_DEACTIVATED_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  signInEmailSchema,
} from '@/lib/constants';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

interface LoginViewProps {
  copy: { title: string; description: string; sentDescription: string };
  otpLink?: OtpLinkParams | null;
}

type EmailFormValues = z.infer<typeof signInEmailSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, 'Please enter the 6-digit code'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

function otpResendCooldownDeadline(): number {
  return Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000;
}

export function LoginView({ copy, otpLink }: LoginViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>(otpLink ? 'otp' : 'email');
  const [capturedEmail, setCapturedEmail] = useState(otpLink?.email ?? '');
  const [isRouting, startTransition] = useTransition();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(
    null,
  );
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  // Countdown tick only — the actual cooldown is enforced server-side in sendCode.
  useEffect(() => {
    if (resendCooldownUntil === null) return;

    const tick = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((resendCooldownUntil - Date.now()) / 1000),
      );
      setResendSecondsLeft(secondsLeft);
      if (secondsLeft === 0) setResendCooldownUntil(null);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [resendCooldownUntil]);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(signInEmailSchema),
    defaultValues: { email: otpLink?.email ?? '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: otpLink?.otp ?? '' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  async function sendCode(email: string): Promise<string | null> {
    // Server-side cooldown check — don't trust the client's own countdown.
    const allowed = await isOtpResendAllowed({ email });
    if (!allowed) return getOtpSendErrorMessage({ status: 429 });

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        console.error('sendVerificationOtp returned an error', result.error);
        return getOtpSendErrorMessage(result.error);
      }
      setResendCooldownUntil(otpResendCooldownDeadline());
      return null;
    } catch (error) {
      console.error('sendVerificationOtp threw', error);
      return getOtpSendErrorMessage(error);
    }
  }

  async function handleEmailSubmit(data: EmailFormValues) {
    try {
      const allowed = await checkSignInAllowed({ email: data.email });
      if (isError(allowed)) {
        toast.error(allowed.error);
        return;
      }
    } catch (error) {
      console.error('checkSignInAllowed failed', error);
      toast.error("Couldn't send the code. Please try again.");
      return;
    }

    const message = await sendCode(data.email);
    if (message) {
      toast.error(message);
      return;
    }

    setCapturedEmail(data.email);
    toast.success('Code sent.');
    setStep('otp');
  }

  const failOtp = useCallback(
    (error: unknown) => {
      console.error('signIn.emailOtp failed', error);
      otpForm.setError('otp', {
        type: 'server',
        message:
          getErrorCode(error) === ACCOUNT_DEACTIVATED_ERROR_CODE
            ? ACCOUNT_DEACTIVATED_MESSAGE
            : getOtpVerifyErrorMessage(error),
      });
    },
    [otpForm],
  );

  // Stable identity (no closed-over state) so the mount effect below can
  // depend on it without re-running on every render.
  const verifyCode = useCallback(
    async (
      email: string,
      otp: string,
    ): Promise<{ success: true } | { success: false; error: unknown }> => {
      try {
        const result = await authClient.signIn.emailOtp({ email, otp });
        if (result.error) return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error };
      }
      return { success: true };
    },
    [],
  );

  async function handleOtpSubmit(data: OtpFormValues) {
    const result = await verifyCode(capturedEmail, data.otp);
    if (result.success)
      // /login decides the destination — name form or onward redirect.
      startTransition(() => router.refresh());
    else failOtp(result.error);
  }

  // Strip the one-time code from the URL so it can't linger in history or a referrer.
  useEffect(() => {
    if (!otpLink) return;
    window.history.replaceState(
      null,
      '',
      strippedOtpLinkHref(window.location.href),
    );
  }, [otpLink]);

  async function handleResend() {
    setIsResending(true);
    const message = await sendCode(capturedEmail);
    setIsResending(false);

    if (message) {
      toast.error(message);
      return;
    }

    otpForm.reset({ otp: '' });
    toast.success('New code sent.');
  }

  function handleBack() {
    otpForm.reset({ otp: '' });
    setStep('email');
  }

  if (step === 'otp') {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">
            {copy.sentDescription}
          </p>
        </div>

        <p className="text-muted-foreground text-sm">
          We sent a code to{' '}
          <strong className="text-foreground">{capturedEmail}</strong>.
        </p>

        <Form {...otpForm}>
          <form
            onSubmit={(e) => void otpForm.handleSubmit(handleOtpSubmit)(e)}
            className="flex w-full flex-col gap-4"
          >
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field, fieldState }) => (
                <FormItem className="flex flex-col items-center gap-2">
                  <FormLabel className="sr-only">One-time code</FormLabel>
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      aria-label="One-time code"
                      value={field.value}
                      disabled={isRouting}
                      onChange={async (value) => {
                        otpForm.clearErrors('otp');
                        field.onChange(value);
                        if (
                          value.length === 6 &&
                          !otpForm.formState.isSubmitting
                        ) {
                          await otpForm.handleSubmit(handleOtpSubmit)();
                        }
                      }}
                      containerClassName="w-full"
                    >
                      <InputOTPGroup className="w-full">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            aria-invalid={!!fieldState.error}
                            className="w-auto flex-1"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <div
                    role="alert"
                    aria-live="polite"
                    className={fieldState.error ? 'min-h-5' : ''}
                  >
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={otpForm.formState.isSubmitting || isRouting}
            >
              {(otpForm.formState.isSubmitting || isRouting) && (
                <Loader2 className="animate-spin" />
              )}
              Verify code
            </Button>
          </form>
        </Form>

        <Button
          variant="secondary"
          type="button"
          onClick={() => void handleResend()}
          disabled={isResending || resendSecondsLeft > 0}
          className="w-full"
        >
          {isResending && <Loader2 className="animate-spin" />}
          {resendSecondsLeft > 0
            ? `Send a new code (${resendSecondsLeft}s)`
            : 'Send a new code'}
        </Button>

        <Button
          variant="secondary"
          type="button"
          onClick={handleBack}
          className="w-full"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.description}</p>
      </div>

      <Form {...emailForm}>
        <form
          onSubmit={(e) => void emailForm.handleSubmit(handleEmailSubmit)(e)}
          className="flex w-full flex-col gap-4"
        >
          <FormField
            control={emailForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={emailForm.formState.isSubmitting}
          >
            {emailForm.formState.isSubmitting && (
              <Loader2 className="animate-spin" />
            )}
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
