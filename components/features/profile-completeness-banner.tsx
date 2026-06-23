import Link from 'next/link';

import { CircleAlert } from 'lucide-react';

import { getProfileCompleteness } from '@/prisma/data/profile';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ProfileCompletenessBannerProps {
  userId: string;
}

export async function ProfileCompletenessBanner({
  userId,
}: ProfileCompletenessBannerProps) {
  const { complete, missingCount } = await getProfileCompleteness(userId);

  if (complete) return null;

  const questionWord = missingCount === 1 ? 'question' : 'questions';

  return (
    <Card className="border-warning bg-warning/5">
      <CardContent className="flex items-start gap-3 p-4">
        <CircleAlert
          className="text-warning mt-0.5 size-5 shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Complete your profile</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {missingCount > 0
                ? `You have ${missingCount} required ${questionWord} left to answer.`
                : 'Finish your profile so you’re ready to apply to open positions.'}
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/profile">Complete profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
