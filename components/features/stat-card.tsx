import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: number;
  dotClassName: string;
}

// Presentational stat card used by PipelineSummary (admin) and ApplicantSummary.
// Server-safe — no 'use client' needed.
export function StatCard({ label, value, dotClassName }: StatCardProps) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 shrink-0 rounded-full ${dotClassName}`}
            aria-hidden="true"
          />
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
