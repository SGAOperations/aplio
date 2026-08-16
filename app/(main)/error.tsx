'use client';

import { ErrorFallback } from '@/components/ui/error-fallback';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <ErrorFallback reset={reset} />
    </div>
  );
}
