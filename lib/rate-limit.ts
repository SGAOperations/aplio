import { NextRequest, NextResponse } from 'next/server';

// Per-tier rate limit caps (requests per minute per IP).
// Webhook is matched before the /api/auth prefix so it gets the higher cap.
const LIMITS = {
  webhook: { windowMs: 60_000, max: 100 },
  api: { windowMs: 60_000, max: 20 },
  public: { windowMs: 60_000, max: 10 },
  private: { windowMs: 60_000, max: 120 },
};

// Module-level hit store: `${tier}:${ip}` → sorted array of request timestamps.
// Reused across middleware invocations within a single worker instance.
// Not shared across instances — see PR notes for the per-instance limitation.
const hits = new Map<string, number[]>();

// Sweep threshold: when the map grows beyond this size, evict stale buckets so
// abandoned IPs don't accumulate memory over the lifetime of the worker.
const SWEEP_THRESHOLD = 5_000;

// NOTE — Vercel deployment prerequisite: Vercel's infrastructure overwrites
// x-forwarded-for before it reaches the middleware, preventing spoofing.
// On non-Vercel proxies (staging tunnels, custom reverse proxies) a client can
// set x-forwarded-for to an arbitrary IP and bypass per-IP limiting entirely.
// If this middleware is ever deployed behind a non-Vercel proxy, add header-
// trust validation (e.g. only trust the rightmost IP, or use a separate trusted
// header set by the proxy) before relying on the rate-limit for security.
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

// Single source of truth for the pathname → tier routing rule — previously
// duplicated between getLimit and tierKey (ENGINEERING §1: abstract at 2+).
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
    // Prune entries outside the current window.
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
    // Fail open: an internal error in the gate must not block legitimate traffic.
    // Still logged so a future regression here leaves a trace instead of
    // silently degrading to "no rate limiting".
    console.error('applyRateLimit failed, allowing request', error);
    return null;
  }
}
