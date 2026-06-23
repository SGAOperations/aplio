import Link from 'next/link';

import { ArrowRight, Briefcase } from 'lucide-react';

import { getPositions } from '@/prisma/data/positions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function OpenPositionsWidget() {
  // Reuse getPositions(false) — returns only open positions. Slight over-fetch
  // of questions fields is acceptable to reuse the shared type (ENGINEERING §2).
  const positions = await getPositions(false);
  const displayed = positions.slice(0, 5);

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Open Positions
          </CardTitle>
          <Link
            href="/positions"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Briefcase
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-sm">
              No open positions right now.
            </p>
            <p className="text-muted-foreground text-xs">
              Check back soon for new opportunities.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {displayed.map((position) => (
              <li key={position.id} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {position.title}
                    </p>
                    {position.description && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {position.description}
                      </p>
                    )}
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/positions/${position.id}/apply`}>Apply</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
