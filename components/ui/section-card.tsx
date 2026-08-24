import Link from 'next/link';
import type { ReactNode } from 'react';

import { ArrowRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const HEADER_CLASS = 'border-b p-4';
const CONTENT_CLASS = 'p-0';

interface SectionCardLink {
  href: string;
  label: string;
  ariaLabel: string;
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  link?: SectionCardLink;
  sectionLabel?: string;
  titleAs?: 'h2' | 'h3';
  children: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  link,
  sectionLabel,
  titleAs: TitleTag,
  children,
}: SectionCardProps) {
  const titleContent = TitleTag ? (
    <CardTitle asChild className="text-base font-semibold">
      <TitleTag>{title}</TitleTag>
    </CardTitle>
  ) : (
    <CardTitle className="text-base font-semibold">{title}</CardTitle>
  );

  const card = (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className={HEADER_CLASS}>
        <div className="flex items-center justify-between">
          <div>
            {titleContent}
            {subtitle && (
              <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
            )}
          </div>
          {link && (
            <Link
              href={link.href}
              aria-label={link.ariaLabel}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              {link.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className={CONTENT_CLASS}>{children}</CardContent>
    </Card>
  );

  return sectionLabel ? (
    <section aria-label={sectionLabel}>{card}</section>
  ) : (
    card
  );
}

interface SectionCardEmptyProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function SectionCardEmpty({
  icon: Icon,
  title,
  description,
  action,
}: SectionCardEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {Icon && (
        <Icon className="text-muted-foreground size-10" aria-hidden="true" />
      )}
      {(title || description) && (
        <div>
          {title && <p className="text-sm font-medium">{title}</p>}
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </p>
          )}
        </div>
      )}
      {action}
    </div>
  );
}

type SectionCardSkeletonRowShape =
  | 'meta'
  | 'badge-meta'
  | 'stacked-action'
  | 'timeline';

interface SectionCardSkeletonProps {
  rows?: number;
  hasSubtitle?: boolean;
  hasLink?: boolean;
  rowShape: SectionCardSkeletonRowShape;
}

export function SectionCardSkeleton({
  rows = 3,
  hasSubtitle = false,
  hasLink = true,
  rowShape,
}: SectionCardSkeletonProps) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className={HEADER_CLASS}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            {hasSubtitle && <Skeleton className="h-4 w-48" />}
          </div>
          {hasLink && <Skeleton className="h-4 w-16" />}
        </div>
      </CardHeader>
      <CardContent className={CONTENT_CLASS}>
        {Array.from({ length: rows }).map((_, i) => (
          <SectionCardSkeletonRow key={i} shape={rowShape} />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionCardSkeletonRow({
  shape,
}: {
  shape: SectionCardSkeletonRowShape;
}) {
  switch (shape) {
    case 'meta':
      return (
        <div
          className={cn(
            'flex items-center justify-between gap-4 border-b px-4 py-3 last:border-0',
          )}
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      );
    case 'badge-meta':
      return (
        <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-4 w-20" />
        </div>
      );
    case 'stacked-action':
      return (
        <div className="border-b px-4 py-4 last:border-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      );
    case 'timeline':
      return (
        <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      );
    default: {
      const exhaustiveCheck: never = shape;
      return exhaustiveCheck;
    }
  }
}
