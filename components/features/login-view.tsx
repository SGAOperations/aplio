'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';

import { checkSignInAllowed } from '@/prisma/actions/auth';

import { authClient } from '@/lib/auth/client';
import {
  getErrorCode,
  getOtpSendErrorMessage,
  getOtpVerifyErrorMessage,
} from '@/lib/auth/errors';
import {
  ACCOUNT_DEACTIVATED_ERROR_CODE,
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
}

type EmailFormValues = z.infer<typeof signInEmailSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, 'Please enter the 6-digit code'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

export function LoginView({ copy }: LoginViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [capturedEmail, setCapturedEmail] = useState('');
  const [isRouting, startTransition] = useTransition();
  const [isResending, setIsResending] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(signInEmailSchema),
    defaultValues: { email: '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  async function sendCode(email: string): Promise<string | null> {
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        console.error('sendVerificationOtp returned an error', result.error);
        return getOtpSendErrorMessage(result.error);
      }
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

  function failOtp(error: unknown) {
    console.error('signIn.emailOtp failed', error);
    otpForm.setError('otp', {
      type: 'server',
      message:
        getErrorCode(error) === ACCOUNT_DEACTIVATED_ERROR_CODE
          ? 'Your account has been deactivated. Please contact an administrator.'
          : getOtpVerifyErrorMessage(error),
    });
  }

  async function handleOtpSubmit(data: OtpFormValues) {
    try {
      const result = await authClient.signIn.emailOtp({
        email: capturedEmail,
        otp: data.otp,
      });
      if (result.error) {
        failOtp(result.error);
        return;
      }
    } catch (error) {
      failOtp(error);
      return;
    }

    // /login decides the destination — name form or onward redirect.
    startTransition(() => router.refresh());
  }

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
            onSubmit={otpForm.handleSubmit(handleOtpSubmit)}
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
                      containerClassName="justify-center"
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            aria-invalid={!!fieldState.error}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <div role="alert" aria-live="polite" className="min-h-5">
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
          variant="link"
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-muted-foreground h-auto p-0 text-sm underline"
        >
          {isResending && <Loader2 className="animate-spin" />}
          Send a new code
        </Button>

        <Button
          variant="link"
          type="button"
          onClick={handleBack}
          className="text-muted-foreground h-auto p-0 text-sm underline"
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
          onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
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
