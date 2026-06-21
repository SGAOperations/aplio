'use client';

import { Button } from '@/components/ui/button';

interface EditPositionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EditPositionError({
  error,
  reset,
}: EditPositionErrorProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">
        {error.digest
          ? `An unexpected error occurred (ref: ${error.digest})`
          : 'An unexpected error occurred. Please try again.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
