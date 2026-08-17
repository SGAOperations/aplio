import { NotFoundFallback } from '@/components/ui/not-found-fallback';

export default function NotFoundPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <NotFoundFallback />
    </div>
  );
}
