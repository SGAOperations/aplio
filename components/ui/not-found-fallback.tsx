import Link from 'next/link';

import { ACTION_ICONS, STATE_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';

export function NotFoundFallback() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <STATE_ICONS.notFound className="text-muted-foreground size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/">
          <ACTION_ICONS.goTo />
          Go home
        </Link>
      </Button>
    </div>
  );
}
