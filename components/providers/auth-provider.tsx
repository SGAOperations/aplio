'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';

import { authClient } from '@/lib/auth/client';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      credentials={false}
      emailOTP
      redirectTo="/positions"
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
