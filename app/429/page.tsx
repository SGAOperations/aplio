import type { Metadata } from 'next';
import Link from 'next/link';

import { ACTION_ICONS, STATE_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';

// Stays static/auth-free (no headers()/searchParams) so it's reachable while rate-limited.
export const metadata: Metadata = {
  title: 'Too many requests',
  robots: { index: false },
};

export default function RateLimitedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <STATE_ICONS.rateLimited className="text-muted-foreground size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Too many requests
      </h1>
      <p className="text-muted-foreground text-sm">
        You&apos;ve made a lot of requests in a short time. Wait about a minute,
        then try again.
      </p>
      <Button asChild>
        <Link href="/">
          <ACTION_ICONS.goTo />
          Go to homepage
        </Link>
      </Button>
    </div>
  );
}
