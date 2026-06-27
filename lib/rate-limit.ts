import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 60_000;

// Per-route caps (requests per WINDOW_MS per IP).
// Order matters for route matching: more specific patterns must come first.
const ROUTE_LIMITS: {
  key: string;
  limit: number;
  matcher: (p: string) => boolean;
}[] = [
  {
    key: '/api/auth/webhook',
    limit: 100,
    matcher: (p) => p === '/api/auth/webhook',
  },
  { key: '/api/auth', limit: 20, matcher: (p) => p.startsWith('/api/auth') },
  { key: '/login', limit: 10, matcher: (p) => p === '/login' },
];

// Module-level hit store: `${routeKey}:${ip}` → sorted array of request timestamps.
// Reused across middleware invocations within a single worker instance.
// Not shared across instances — see PR notes for the per-instance limitation.
const hits = new Map<string, number[]>();

// Sweep threshold: when the map grows beyond this size, evict stale buckets so
// abandoned IPs don't accumulate memory over the lifetime of the worker.
const SWEEP_THRESHOLD = 5_000;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

function selectRoute(pathname: string): { key: string; limit: number } | null {
  for (const route of ROUTE_LIMITS) {
    if (route.matcher(pathname)) return { key: route.key, limit: route.limit };
  }
  return null;
}

function maybeSweep(now: number): void {
  if (hits.size < SWEEP_THRESHOLD) return;
  for (const [bucket, timestamps] of hits) {
    const newest = timestamps.at(-1);
    if (newest === undefined || newest < now - WINDOW_MS) hits.delete(bucket);
  }
}

export function applyRateLimit(request: NextRequest): NextResponse | null {
  try {
    const { pathname } = request.nextUrl;
    const route = selectRoute(pathname);
    if (!route) return null;

    const ip = getClientIp(request);
    const bucket = `${route.key}:${ip}`;
    const now = Date.now();

    maybeSweep(now);

    const timestamps = hits.get(bucket) ?? [];
    // Prune entries outside the current window.
    const windowStart = now - WINDOW_MS;
    const recent = timestamps.filter((t) => t >= windowStart);

    if (recent.length >= route.limit) {
      // Oldest timestamp in the current window determines when a slot next frees.
      const oldest = recent[0]!;
      const retryAfter = Math.max(
        1,
        Math.ceil((oldest + WINDOW_MS - now) / 1000),
      );
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(route.limit),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    recent.push(now);
    hits.set(bucket, recent);
    return null;
  } catch {
    // Fail open: an internal error in the gate must not block legitimate traffic.
    return null;
  }
}
