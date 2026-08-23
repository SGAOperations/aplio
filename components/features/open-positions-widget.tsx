import Link from 'next/link';

import { Briefcase } from 'lucide-react';

import { getOpenPositions } from '@/prisma/data/positions';

import { markdownToPlainText } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface OpenPositionsWidgetProps {
  limit?: number;
}

export async function OpenPositionsWidget({
  limit = 3,
}: OpenPositionsWidgetProps) {
  // getOpenPositions() returns only accepting positions (no upcoming/closed_by_date).
  const positions = await getOpenPositions();
  const displayed = positions.slice(0, limit);

  return (
    <SectionCard
      title="Open Positions"
      link={{
        href: '/positions',
        label: 'See all',
        ariaLabel: 'See all positions',
      }}
    >
      {displayed.length === 0 ? (
        <SectionCardEmpty
          icon={Briefcase}
          title="No open positions right now."
          description="Check back soon for new opportunities."
        />
      ) : (
        <ul className="divide-y">
          {displayed.map((position) => (
            <li key={position.id} className="flex flex-col gap-1.5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {position.title}
                  </p>
                  {markdownToPlainText(position.description) && (
                    <div className="text-muted-foreground mt-0.5 max-h-8 overflow-clip text-xs [overflow-wrap:anywhere]">
                      <Markdown
                        variant="compact"
                        source={position.description}
                        className="[&_p]:line-clamp-2"
                      />
                    </div>
                  )}
                </div>
                {/* All positions from getOpenPositions() are accepting — always show Apply */}
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/positions/${position.id}/apply`}>Apply</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
