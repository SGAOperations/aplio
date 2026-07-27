import type { Metadata } from 'next';
import Link from 'next/link';

import { loginAsBypassUser } from '@/prisma/services/dev-bypass';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Dev Login' };

export default function BypassLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dev Login</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select a role to log in as a bypass user.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <form action={loginAsBypassUser.bind(null, 'admin')}>
            <Button type="submit" className="w-full">
              Admin
            </Button>
          </form>
          <form action={loginAsBypassUser.bind(null, 'applicant')}>
            <Button type="submit" variant="outline" className="w-full">
              Applicant
            </Button>
          </form>
          <form action={loginAsBypassUser.bind(null, 'position-manager')}>
            <Button type="submit" variant="outline" className="w-full">
              Position Manager
            </Button>
          </form>
        </div>
        <div className="border-border flex flex-col items-center gap-2 border-t pt-4">
          <p className="text-muted-foreground text-xs">
            Or sign in with a real account to test production-style auth.
          </p>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/login">Sign in with real auth</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
