import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightTileProps {
  label: string;
  value: string;
  caption?: string;
}

/** A bare stat tile — label, string value, caption. Unlike `StatCard`, the
 * value is a formatted string (not a number) and there's no status dot. */
export function InsightTile({ label, value, caption }: InsightTileProps) {
  return (
    <Card className="gap-1 p-4">
      <CardContent className="p-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {caption && (
          <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function InsightTileSkeleton() {
  return (
    <Card className="gap-1 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-1 h-7 w-16" />
    </Card>
  );
}
