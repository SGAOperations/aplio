import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* First widget */}
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

      {/* Second widget */}
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
    </div>
  );
}
