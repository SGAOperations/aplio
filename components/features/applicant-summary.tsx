import { getMySubmittedCount } from '@/prisma/data/applications';
import { getAcceptingPositionsCount } from '@/prisma/data/positions';

import { StatCard } from '@/components/features/stat-card';

interface ApplicantSummaryProps {
  userId: string;
}

// Revised per change request: applicant sees exactly 2 stat cards —
// Submitted and Open positions. In-review/accepted cards were removed.
export async function ApplicantSummary({ userId }: ApplicantSummaryProps) {
  const [submitted, openPositions] = await Promise.all([
    getMySubmittedCount(userId),
    getAcceptingPositionsCount(),
  ]);

  return (
    <section aria-label="Application summary">
      {/* Stable 2-up grid at every breakpoint — no column bump needed for two items */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Submitted"
          value={submitted}
          dotClassName="bg-primary"
        />
        <StatCard
          label="Open positions"
          value={openPositions}
          dotClassName="bg-info"
        />
      </div>
    </section>
  );
}

export function ApplicantSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4">
          <div className="bg-muted h-3 w-20 animate-pulse rounded" />
          <div className="bg-muted mt-2 h-8 w-12 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
