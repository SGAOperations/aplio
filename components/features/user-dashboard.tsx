import { Suspense } from 'react';

import { MyApplicationsWidget } from '@/components/features/my-applications-widget';
import { OpenPositionsWidget } from '@/components/features/open-positions-widget';
import { ProfileCompletenessBanner } from '@/components/features/profile-completeness-banner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface UserDashboardProps {
  userId: string;
  userName: string | null;
}

function MyApplicationsWidgetSkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 last:border-0">
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OpenPositionsWidgetSkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-4 last:border-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function UserDashboard({ userId, userName }: UserDashboardProps) {
  const firstName = userName?.split(' ')[0];
  const heading = firstName ? `Welcome back, ${firstName}` : 'Welcome to Aplio';

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s a summary of your applications.
        </p>
      </div>

      <Suspense fallback={null}>
        <ProfileCompletenessBanner userId={userId} />
      </Suspense>

      <Suspense fallback={<MyApplicationsWidgetSkeleton />}>
        <MyApplicationsWidget userId={userId} />
      </Suspense>

      <Suspense fallback={<OpenPositionsWidgetSkeleton />}>
        <OpenPositionsWidget />
      </Suspense>
    </div>
  );
}
