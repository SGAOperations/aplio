import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

// No dynamic APIs (headers()/searchParams) so this stays static and auth-free —
// that's what keeps it reachable while the caller is rate-limited.
export const metadata: Metadata = {
  title: 'Too many requests',
  robots: { index: false },
};

export default function RateLimitedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Too many requests
      </h1>
      <p className="text-muted-foreground text-sm">
        You&apos;ve made a lot of requests in a short time. Wait about a minute,
        then try again.
      </p>
      <Button asChild>
        <Link href="/">Go to homepage</Link>
      </Button>
    </div>
  );
}
