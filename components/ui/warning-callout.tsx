import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface WarningCalloutProps {
  id?: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

export function WarningCallout({
  id,
  icon: Icon,
  className,
  children,
}: WarningCalloutProps) {
  return (
    <div
      id={id}
      className={cn(
        'border-warning/40 bg-warning/10 text-foreground flex gap-2 rounded-lg border p-3 text-sm',
        className,
      )}
    >
      {Icon && (
        <Icon
          className="text-warning mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
