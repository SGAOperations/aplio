import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { safeRedirectTo, withRedirectTo } from '@/lib/auth/redirect';
import {
  getDeactivatedSessionUser,
  getOptionalUser,
  sgauthLoginUrl,
} from '@/lib/auth/server';
import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';
import { isBypassAllowed } from '@/lib/utils';

import { NameField } from '@/components/features/name-field';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sign In' };

// Sign-in itself happens on SGAuth; this page routes there, and keeps the name step.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { redirectTo } = await searchParams;
  const safeTo = safeRedirectTo(redirectTo);

  const user = await getOptionalUser();
  if (user?.name?.trim()) redirect(safeTo);

  // A live session for a deactivated row — routing, not denial.
  if (!user && (await getDeactivatedSessionUser()))
    redirect('/login/deactivated');

  // Must match isBypassAllowed, so the affordance and the action agree.
  const loginHref = await sgauthLoginUrl(safeTo);
  if (!user && !isBypassAllowed()) redirect(loginHref);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {user ? (
        <NameField defaultName={user.name ?? ''} redirectTo={safeTo} />
      ) : (
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" asChild>
            <a href={loginHref}>Sign in with SGA</a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href={withRedirectTo('/login/bypass', redirectTo)}>
              Dev: switch user via bypass login
            </Link>
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        <Link
          href={PRIVACY_HREF}
          className="hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        {' · '}
        <Link
          href={TERMS_HREF}
          className="hover:text-foreground hover:underline"
        >
          Terms of Service
        </Link>
      </p>
    </div>
  );
}
