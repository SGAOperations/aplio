import Link from 'next/link';
import type { ReactNode } from 'react';

import { ACTION_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description?: string;
  titleAdornment?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  description,
  titleAdornment,
  actions,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 w-fit">
          <Link href={backHref}>
            <ACTION_ICONS.back />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {titleAdornment}
          </div>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
