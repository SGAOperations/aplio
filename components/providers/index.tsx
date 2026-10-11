'use client';

import { useEffect } from 'react';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import posthog from 'posthog-js';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </NuqsAdapter>
  );
}

interface PostHogIdentityProps {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

export function PostHogIdentity({
  userId,
  email,
  name,
  role,
}: PostHogIdentityProps) {
  useEffect(() => {
    posthog.identify(userId, {
      email,
      ...(name ? { name } : {}),
      role,
    });
  }, [email, name, role, userId]);

  return null;
}
