'use client';

import { useSyncExternalStore } from 'react';

import { ORG_TIMEZONE } from '@/lib/constants';
import { formatInstant, formatRelativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface LocalTimeProps {
  date: Date;
  precision?: 'date' | 'datetime' | 'relative';
  className?: string;
}

// No-op subscribe: the viewer's timezone never changes during a session, so this
// store only exists to flip once from the server snapshot to the client snapshot
// on hydration, without useEffect.
function subscribe() {
  return () => {};
}

function useViewerTimeZone(): string {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => ORG_TIMEZONE,
  );
}

// Renders one instant, one way, everywhere — the semantic <time> always carries
// the exact instant + zone via dateTime/title even in the 'date'/'relative' variants.
export function LocalTime({
  date,
  precision = 'date',
  className,
}: LocalTimeProps) {
  const timeZone = useViewerTimeZone();
  const isoString = date.toISOString();
  const title = formatInstant(date, { precision: 'datetime', timeZone });

  const display =
    precision === 'relative'
      ? formatRelativeTime(date, new Date(), timeZone)
      : formatInstant(date, { precision, timeZone });

  return (
    <time dateTime={isoString} title={title} className={cn(className)}>
      {display}
    </time>
  );
}
