import Link from 'next/link';

import type { ProfileCompleteness } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ProfileReturnBarProps {
  destination: string;
  completeness: ProfileCompleteness;
}

export function ProfileReturnBar({
  destination,
  completeness,
}: ProfileReturnBarProps) {
  const { complete, missingCount } = completeness;
  const statusText = complete
    ? 'Profile complete'
    : `${missingCount} required ${missingCount === 1 ? 'question' : 'questions'} left`;

  return (
    <Card className="sticky bottom-0 flex-row items-center justify-between gap-4 p-4">
      <p id="profile-return-status" role="status" aria-live="polite">
        {statusText}
      </p>
      {complete ? (
        <Button asChild>
          <Link href={destination}>Continue</Link>
        </Button>
      ) : (
        <Button disabled aria-describedby="profile-return-status">
          Continue
        </Button>
      )}
    </Card>
  );
}
