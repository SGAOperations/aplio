import type { ReactNode } from 'react';

import { MainLayout } from '@/components/layouts/main-layout';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
