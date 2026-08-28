import Link from 'next/link';

import { getProfileCompleteness } from '@/prisma/data/profile';

import { ACTION_ICONS, STATE_ICONS } from '@/lib/icons';

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
    <Card className="border-warning bg-warning/5 gap-0 p-0">
      <CardContent className="flex items-start gap-3 p-4">
        <STATE_ICONS.warning className="text-warning mt-0.5 size-5 shrink-0" />
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Complete your profile</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {`You have ${missingCount} required ${questionWord} left to answer.`}
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/profile">
              <ACTION_ICONS.goTo />
              Complete profile
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
