import { ORG_TIMEZONE } from '@/lib/constants';

type DatePrecision = 'date' | 'datetime';

function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );

  return asUTC - at.getTime();
}

function parseOrgDay(day: string): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number);
  if (year === undefined || month === undefined || date === undefined)
    throw new Error(`Invalid org day: ${day}`);
  return [year, month, date];
}

// `naive` is org-local wall time encoded as UTC fields; resolves it to the real
// UTC instant. Two-pass since the offset itself depends on the instant (DST).
function resolveOrgWallClock(naive: Date): Date {
  const firstOffset = zoneOffsetMs(ORG_TIMEZONE, naive);
  const estimate = naive.getTime() - firstOffset;
  const secondOffset = zoneOffsetMs(ORG_TIMEZONE, new Date(estimate));
  return new Date(naive.getTime() - secondOffset);
}

/** `YYYY-MM-DD` (org-local calendar day) → the UTC instant of that day's start. */
export function orgDayStart(day: string): Date {
  const [year, month, date] = parseOrgDay(day);
  return resolveOrgWallClock(
    new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0)),
  );
}

// `YYYY-MM-DD` (org-local calendar day) → the UTC instant of that day's end (23:59:59.999).
// Resolves the whole second first — zoneOffsetMs's Date.UTC always carries ms=0.
export function orgDayEnd(day: string): Date {
  const [year, month, date] = parseOrgDay(day);
  const wholeSecond = resolveOrgWallClock(
    new Date(Date.UTC(year, month - 1, date, 23, 59, 59, 0)),
  );
  return new Date(wholeSecond.getTime() + 999);
}

/** UTC instant → its org-local calendar day, as `YYYY-MM-DD`. */
export function toOrgDayString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatInstant(
  date: Date,
  { precision, timeZone }: { precision: DatePrecision; timeZone: string },
): string {
  if (precision === 'date')
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Buckets to "Nm/Nh/Nd ago", falling back to an absolute date beyond a week.
 */
export function formatRelativeTime(
  date: Date,
  now: Date = new Date(),
  timeZone: string = ORG_TIMEZONE,
): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatInstant(date, { precision: 'date', timeZone });
}
