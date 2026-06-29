import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { cn } from '@/lib/utils';

import { Providers } from '@/components/providers';
import { AuthProvider } from '@/components/providers/auth-provider';

import './globals.css';

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Aplio', template: 'Aplio • %s' },
  description: 'A student government application management system.',
  icons: [
    // Light-mode favicon: white/light background logo
    { url: '/logo-light.svg', media: '(prefers-color-scheme: light)' },
    // Dark-mode favicon: dark background logo
    { url: '/logo-dark.svg', media: '(prefers-color-scheme: dark)' },
  ],
  openGraph: {
    title: 'Aplio',
    description: 'A student government application management system.',
    images: [{ url: '/logo-light.svg', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'Aplio',
    description: 'A student government application management system.',
    images: ['/logo-light.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('w-full font-sans antialiased', inter.variable)}>
        <AuthProvider>
          <Providers>{children}</Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
