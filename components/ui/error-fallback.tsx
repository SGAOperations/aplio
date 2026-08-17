import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  reset: () => void;
}

export function ErrorFallback({ reset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. You can try again or go home.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
