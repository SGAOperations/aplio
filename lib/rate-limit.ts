import { NextRequest, NextResponse } from 'next/server';

// Order matters: webhook is matched before the /api/auth prefix to get the higher cap.
const LIMITS = {
  webhook: { windowMs: 60_000, max: 100 },
  api: { windowMs: 60_000, max: 20 },
  public: { windowMs: 60_000, max: 10 },
  private: { windowMs: 60_000, max: 120 },
};

// Per worker instance, so the effective limit scales with instance count.
const hits = new Map<string, number[]>();

// Past this size, stale buckets are evicted so abandoned IPs don't leak memory.
const SWEEP_THRESHOLD = 5_000;

// Safe only on Vercel, which overwrites x-forwarded-for; elsewhere it's spoofable.
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

function classifyRequest(pathname: string): {
  tier: string;
  limit: { windowMs: number; max: number };
} {
  if (pathname === '/api/auth/webhook')
    return { tier: 'webhook', limit: LIMITS.webhook };
  if (pathname.startsWith('/api/')) return { tier: 'api', limit: LIMITS.api };
  if (pathname === '/login' || pathname === '/')
    return { tier: 'public', limit: LIMITS.public };
  return { tier: 'private', limit: LIMITS.private };
}

// Max window across all tiers — used to evict buckets that are stale for any tier.
const MAX_WINDOW_MS = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));

function maybeSweep(now: number): void {
  if (hits.size < SWEEP_THRESHOLD) return;
  for (const [bucket, timestamps] of hits) {
    const newest = timestamps.at(-1);
    if (newest === undefined || newest < now - MAX_WINDOW_MS)
      hits.delete(bucket);
  }
}

export function applyRateLimit(request: NextRequest): NextResponse | null {
  try {
    const { pathname } = request.nextUrl;
    const { tier, limit } = classifyRequest(pathname);

    const ip = getClientIp(request);
    const bucket = `${tier}:${ip}`;
    const now = Date.now();

    maybeSweep(now);

    const timestamps = hits.get(bucket) ?? [];
    const windowStart = now - limit.windowMs;
    const recent = timestamps.filter((t) => t >= windowStart);

    if (recent.length >= limit.max) {
      // Oldest timestamp in the current window determines when a slot next frees.
      const oldest = recent[0]!;
      const retryAfter = Math.max(
        1,
        Math.ceil((oldest + limit.windowMs - now) / 1000),
      );
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit.max),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    recent.push(now);
    hits.set(bucket, recent);
    return null;
  } catch (error) {
    // Fail open, but logged: silent degradation to no rate limiting is worse.
    console.error('applyRateLimit failed, allowing request', error);
    return null;
  }
}
