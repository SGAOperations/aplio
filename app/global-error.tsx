'use client';

import { inter } from '@/lib/fonts';
import { cn } from '@/lib/utils';

import { ErrorFallback } from '@/components/ui/error-fallback';

import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className={cn('w-full font-sans antialiased', inter.variable)}>
        <title>Aplio • Something went wrong</title>
        <div className="flex min-h-screen items-center justify-center p-6">
          <ErrorFallback reset={reset} />
        </div>
      </body>
    </html>
  );
}
