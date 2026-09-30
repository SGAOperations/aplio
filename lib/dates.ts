import { DATE_SEARCH_YEAR_SPAN, ORG_TIMEZONE } from '@/lib/constants';

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

// Calendar-date arithmetic on the Y/M/D triple — never on a resolved instant,
// so a DST transition inside the shifted range can't shift the day count.
function shiftOrgDay(day: string, deltaDays: number): string {
  const [year, month, date] = parseOrgDay(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** The org day before `now`'s org day, with its instant bounds. */
export function previousOrgDay(now: Date): {
  day: string;
  start: Date;
  end: Date;
} {
  const day = shiftOrgDay(toOrgDayString(now), -1);
  return { day, start: orgDayStart(day), end: orgDayEnd(day) };
}

/** `YYYY-MM-DD` of the Monday of `now`'s org-local week. */
export function currentOrgWeekStart(now: Date): string {
  const day = toOrgDayString(now);
  const [year, month, date] = parseOrgDay(day);
  const dow = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  return shiftOrgDay(day, -daysSinceMonday);
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

// Full month names for prefix-matching in date-search tokens.
const FULL_MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// -1 if not a valid month token; 0–11 (0=Jan) if it is.
// Token must be ≥3 chars and be a prefix of a full month name (after stripping a trailing period).
function parseMonthToken(token: string): number {
  const t = token.endsWith('.') ? token.slice(0, -1) : token;
  if (t.length < 3) return -1;
  return FULL_MONTH_NAMES.findIndex((name) => name.startsWith(t));
}

function isValidDate(year: number, month1: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month1 - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month1 &&
    d.getUTCDate() === day
  );
}

function padded(n: number): string {
  return String(n).padStart(2, '0');
}

function yearRange(year: number): { gte: Date; lt: Date } {
  return {
    gte: orgDayStart(`${year}-01-01`),
    lt: orgDayStart(`${year + 1}-01-01`),
  };
}

function monthRange(year: number, month0: number): { gte: Date; lt: Date } {
  const start = `${year}-${padded(month0 + 1)}-01`;
  // Roll December into the next year.
  const nextMonth = new Date(Date.UTC(year, month0 + 1, 1));
  const end = `${nextMonth.getUTCFullYear()}-${padded(nextMonth.getUTCMonth() + 1)}-01`;
  return { gte: orgDayStart(start), lt: orgDayStart(end) };
}

function dayRange(
  year: number,
  month0: number,
  day: number,
): { gte: Date; lt: Date } {
  const start = `${year}-${padded(month0 + 1)}-${padded(day)}`;
  const next = new Date(Date.UTC(year, month0, day + 1));
  const end = `${next.getUTCFullYear()}-${padded(next.getUTCMonth() + 1)}-${padded(next.getUTCDate())}`;
  return { gte: orgDayStart(start), lt: orgDayStart(end) };
}

/**
 * Parses a free-text search query into submitted-date ranges.
 * Returns [] when the query does not match a recognized date form.
 * All boundaries are org-local days (America/New_York).
 *
 * Supported forms (in precedence order):
 *   YYYY                   → that year
 *   Mon YYYY / YYYY Mon    → that month
 *   M/YYYY or MM/YYYY      → that month
 *   Mon D YYYY             → that day (comma between D and YYYY is ignored)
 *   M/D/YYYY or MM/DD/YYYY → that day
 *   Mon                    → that month across DATE_SEARCH_YEAR_SPAN years
 *   Mon D                  → that day across DATE_SEARCH_YEAR_SPAN years (skips non-leap Feb 29)
 */
export function parseSubmittedDateQuery(
  q: string,
  now: Date = new Date(),
): { gte: Date; lt: Date }[] {
  const normalized = q
    .trim()
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ');

  const currentYear = parseInt(toOrgDayString(now).slice(0, 4), 10);
  const startYear = currentYear - DATE_SEARCH_YEAR_SPAN + 1;

  const tokens = normalized.split(' ');

  if (tokens.length === 1) {
    const t = tokens[0]!;

    // YYYY
    if (/^\d{4}$/.test(t)) return [yearRange(parseInt(t, 10))];

    // Mon (yearless)
    const m = parseMonthToken(t);
    if (m !== -1) {
      const ranges: { gte: Date; lt: Date }[] = [];
      for (let y = startYear; y <= currentYear; y++)
        ranges.push(monthRange(y, m));
      return ranges;
    }

    // M/YYYY or MM/YYYY
    const slashMonth = /^(\d{1,2})\/(\d{4})$/.exec(t);
    if (slashMonth) {
      const mn = parseInt(slashMonth[1]!, 10);
      const yr = parseInt(slashMonth[2]!, 10);
      if (mn < 1 || mn > 12) return [];
      return [monthRange(yr, mn - 1)];
    }

    // M/D/YYYY or MM/DD/YYYY
    const slashDay = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (slashDay) {
      const mn = parseInt(slashDay[1]!, 10);
      const dy = parseInt(slashDay[2]!, 10);
      const yr = parseInt(slashDay[3]!, 10);
      if (!isValidDate(yr, mn, dy)) return [];
      return [dayRange(yr, mn - 1, dy)];
    }

    return [];
  }

  if (tokens.length === 2) {
    const [a, b] = tokens as [string, string];
    const aYear = /^\d{4}$/.test(a) ? parseInt(a, 10) : null;
    const bYear = /^\d{4}$/.test(b) ? parseInt(b, 10) : null;
    const aMonth = parseMonthToken(a);
    const bMonth = parseMonthToken(b);

    // Mon YYYY
    if (aMonth !== -1 && bYear !== null) return [monthRange(bYear, aMonth)];
    // YYYY Mon
    if (aYear !== null && bMonth !== -1) return [monthRange(aYear, bMonth)];

    // Mon D (yearless)
    if (aMonth !== -1 && /^\d{1,2}$/.test(b)) {
      const dy = parseInt(b, 10);
      const ranges: { gte: Date; lt: Date }[] = [];
      for (let y = startYear; y <= currentYear; y++) {
        if (!isValidDate(y, aMonth + 1, dy)) continue;
        ranges.push(dayRange(y, aMonth, dy));
      }
      return ranges;
    }

    return [];
  }

  if (tokens.length === 3) {
    const [a, b, c] = tokens as [string, string, string];
    const aMonth = parseMonthToken(a);
    // Mon D YYYY (comma already collapsed into the space between b and c)
    if (aMonth !== -1 && /^\d{1,2}$/.test(b) && /^\d{4}$/.test(c)) {
      const dy = parseInt(b, 10);
      const yr = parseInt(c, 10);
      if (!isValidDate(yr, aMonth + 1, dy)) return [];
      return [dayRange(yr, aMonth, dy)];
    }

    return [];
  }

  return [];
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
