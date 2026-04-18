import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
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
