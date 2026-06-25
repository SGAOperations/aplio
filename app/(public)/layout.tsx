import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { getIsBypass, getOptionalUser } from '@/lib/auth/server';
import type { NavIdentity } from '@/lib/types';

import { UserMenu } from '@/components/layouts/user-menu';
import { Button } from '@/components/ui/button';

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getOptionalUser();
  const isBypass = await getIsBypass();

  const identity: NavIdentity | null = user
    ? {
        email: user.email,
        roleLabel: user.isAdmin ? 'Admin' : 'User',
        isBypass,
      }
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/positions" className="flex items-center gap-2">
            <Image src="/logo-icon.svg" alt="Aplio" width={32} height={32} />
            <span className="text-sm font-semibold tracking-tight">Aplio</span>
          </Link>
          {identity ? (
            <UserMenu identity={identity} />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
