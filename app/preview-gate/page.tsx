import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { unlockPreviewGate } from '@/prisma/actions/preview-gate';

import {
  GATE_COOKIE,
  nowSeconds,
  readGateConfig,
  safeNextPath,
  verifyGateCookie,
} from '@/lib/preview-gate';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = {
  title: 'Test environment',
  robots: { index: false, follow: false },
};

const ERROR_COPY = {
  wrong: "That password isn't right.",
  rate: 'Too many attempts. Try again in a few minutes.',
} as const;

function isErrorKey(value: unknown): value is keyof typeof ERROR_COPY {
  return value === 'wrong' || value === 'rate';
}

export default async function PreviewGatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const config = readGateConfig(process.env);
  if (config.mode !== 'on') notFound();

  const { next, error } = await searchParams;
  const target = safeNextPath(next);

  const cookie = (await cookies()).get(GATE_COOKIE)?.value;
  if (await verifyGateCookie(config.password, cookie, nowSeconds()))
    redirect(target);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Aplio test environment</h1>
          <p className="text-muted-foreground text-sm">
            This is a pre-production copy of Aplio. Enter the access password to
            continue.
          </p>
        </div>
        <form action={unlockPreviewGate} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={target} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Access password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={isErrorKey(error) || undefined}
              aria-describedby={
                isErrorKey(error) ? 'password-error' : undefined
              }
            />
            {isErrorKey(error) && (
              <p
                id="password-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {ERROR_COPY[error]}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </div>
    </main>
  );
}
