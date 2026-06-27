'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';

import { authClient } from '@/lib/auth/client';

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
  redirectTo: string;
  copy: { title: string; description: string; sentDescription: string };
}

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, 'Please enter the 6-digit code'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

export function LoginView({ redirectTo, copy }: LoginViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [capturedEmail, setCapturedEmail] = useState('');

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  async function handleEmailSubmit(data: EmailFormValues) {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: data.email,
      type: 'sign-in',
    });

    if (result.error) {
      const message =
        result.error.message ?? "Couldn't send the code. Please try again.";
      toast.error(message);
      return;
    }

    setCapturedEmail(data.email);
    toast.success('Code sent.');
    setStep('otp');
  }

  async function handleOtpSubmit(data: OtpFormValues) {
    const result = await authClient.signIn.emailOtp({
      email: capturedEmail,
      otp: data.otp,
    });

    if (result.error) {
      toast.error('That code is incorrect or expired.');
      otpForm.reset({ otp: '' });
      return;
    }

    router.refresh();
    router.push(redirectTo);
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
              render={({ field }) => (
                <FormItem className="flex flex-col items-center gap-2">
                  <FormLabel className="sr-only">One-time code</FormLabel>
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      aria-label="One-time code"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        // Auto-submit when all 6 digits are entered
                        if (value.length === 6) {
                          void otpForm.handleSubmit(handleOtpSubmit)();
                        }
                      }}
                      containerClassName="justify-center"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={otpForm.formState.isSubmitting}
            >
              {otpForm.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Verify code
            </Button>
          </form>
        </Form>

        <button
          type="button"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-ring text-sm underline focus-visible:rounded-sm focus-visible:outline-2"
        >
          Use a different email
        </button>
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
