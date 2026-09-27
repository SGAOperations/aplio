import { cn } from '@/lib/utils';

import type { BadgeVariant } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatusDot } from '@/components/ui/status-dot';

interface StatCardProps {
  label: string;
  value: number;
  dotVariant: BadgeVariant;
  className?: string;
}

// Presentational and server-safe — no 'use client' needed.
export function StatCard({
  label,
  value,
  dotVariant,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <CardContent className="p-0">
        <div className="flex items-center gap-1.5">
          <StatusDot variant={dotVariant} />
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
