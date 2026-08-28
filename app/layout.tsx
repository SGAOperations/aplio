import type { Metadata } from 'next';

import { APP_DESCRIPTION, APP_NAME } from '@/lib/constants';
import { inter } from '@/lib/fonts';
import { cn } from '@/lib/utils';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `${APP_NAME} • %s` },
  description: APP_DESCRIPTION,
  icons: [
    // Light-mode favicon: white/light background logo
    { url: '/logo-light.svg', media: '(prefers-color-scheme: light)' },
    // Dark-mode favicon: dark background logo
    { url: '/logo-dark.svg', media: '(prefers-color-scheme: dark)' },
  ],
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: '/logo-light.svg', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ['/logo-light.svg'],
  },
  appleWebApp: { title: APP_NAME },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('w-full font-sans antialiased', inter.variable)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
