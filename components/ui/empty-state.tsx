import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Icon className="text-muted-foreground size-12" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold">{title}</p>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
