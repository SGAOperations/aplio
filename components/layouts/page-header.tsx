import Link from 'next/link';
import type { ReactNode } from 'react';

import { ACTION_ICONS } from '@/lib/icons';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const WRAPPER_CLASS = 'flex flex-col gap-1';
const ROW_CLASS =
  'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between';
const TITLE_ROW_CLASS = 'flex flex-wrap items-center gap-2';
const DESCRIPTION_CLASS = 'text-muted-foreground mt-1 text-sm';
const ACTIONS_CLASS = 'flex shrink-0 flex-wrap items-center gap-2';

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
    <div className={WRAPPER_CLASS}>
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 w-fit">
          <Link href={backHref}>
            <ACTION_ICONS.back />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className={ROW_CLASS}>
        <div>
          <div className={TITLE_ROW_CLASS}>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {titleAdornment}
          </div>
          {description && <p className={DESCRIPTION_CLASS}>{description}</p>}
        </div>
        {actions && <div className={ACTIONS_CLASS}>{actions}</div>}
      </div>
    </div>
  );
}

interface PageHeaderSkeletonProps {
  titleWidth?: string;
  hasDescription?: boolean;
  hasAdornment?: boolean;
  hasBack?: boolean;
  actions?: string[];
  actionSize?: 'sm' | 'default';
}

export function PageHeaderSkeleton({
  titleWidth = 'w-48',
  hasDescription = true,
  hasAdornment = false,
  hasBack = false,
  actions,
  actionSize = 'default',
}: PageHeaderSkeletonProps) {
  return (
    <div className={WRAPPER_CLASS}>
      {hasBack && <Skeleton className="mb-2 h-11 w-32 md:h-8" />}
      <div className={ROW_CLASS}>
        <div>
          <div className={TITLE_ROW_CLASS}>
            <Skeleton className={cn('h-8', titleWidth)} />
            {hasAdornment && <Skeleton className="h-5.5 w-20 rounded-md" />}
          </div>
          {hasDescription && <Skeleton className="mt-1 h-5 w-72" />}
        </div>
        {actions && actions.length > 0 && (
          <div className={ACTIONS_CLASS}>
            {actions.map((widthClass, i) => (
              <Skeleton
                key={i}
                className={cn(
                  actionSize === 'sm' ? 'h-11 md:h-8' : 'h-11 md:h-9',
                  widthClass,
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
