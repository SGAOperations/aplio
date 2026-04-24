import type { ReactNode } from 'react';

import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
