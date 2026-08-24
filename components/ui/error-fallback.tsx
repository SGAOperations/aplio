import Link from 'next/link';

import { ACTION_ICONS, STATE_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  reset: () => void;
}

export function ErrorFallback({ reset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <STATE_ICONS.error className="text-destructive size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. You can try again or go home.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <ACTION_ICONS.retry />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <ACTION_ICONS.goTo />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
