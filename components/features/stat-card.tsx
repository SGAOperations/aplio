import Link from 'next/link';

import { cn } from '@/lib/utils';

import type { BadgeVariant } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatusDot } from '@/components/ui/status-dot';

interface StatCardBase {
  label: string;
  value: number;
  dotVariant: BadgeVariant;
  className?: string;
}

type StatCardProps = StatCardBase &
  ({ href: string; linkLabel: string } | { href?: never; linkLabel?: never });

// Presentational and server-safe — no 'use client' needed.
export function StatCard({
  label,
  value,
  dotVariant,
  className,
  href,
  linkLabel,
}: StatCardProps) {
  const content = (
    <CardContent className="p-0">
      <div className="flex items-center gap-1.5">
        <StatusDot variant={dotVariant} />
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </CardContent>
  );

  if (!href) return <Card className={cn('p-4', className)}>{content}</Card>;

  return (
    <Link
      href={href}
      aria-label={linkLabel}
      className={cn(
        'focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      <Card className="hover:bg-muted/50 h-full p-4 transition-colors">
        {content}
      </Card>
    </Link>
  );
}
