import { AppShell } from '@/components/layouts/app-shell';
import { NotFoundFallback } from '@/components/ui/not-found-fallback';

export default function NotFoundPage() {
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center">
        <NotFoundFallback />
      </div>
    </AppShell>
  );
}
