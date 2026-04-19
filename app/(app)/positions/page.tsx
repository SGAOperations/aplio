export const dynamic = 'force-dynamic';

import { getOpenPositions } from '@/prisma/data/positions';

import { PositionCard } from '@/components/features/position-card';

export default async function PositionsPage() {
  const positions = await getOpenPositions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Open Positions</h1>

      {positions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no open positions at this time.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {positions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      )}
    </div>
  );
}
