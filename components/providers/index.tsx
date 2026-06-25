import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';

import { QueryProvider } from './query-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
      </ThemeProvider>
    </NuqsAdapter>
  );
}
