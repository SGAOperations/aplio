import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { cn } from '@/lib/utils';

import './globals.css';

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Aplio', template: 'Aplio - %s' },
  description: 'A student government application management system.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={cn('w-full font-sans antialiased', inter.variable)}>
        {children}
      </body>
    </html>
  );
}
