import Link from 'next/link';
import type { ReactNode } from 'react';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 w-fit">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
