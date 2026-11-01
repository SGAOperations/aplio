import { NextRequest, NextResponse } from 'next/server';

import {
  GATE_COOKIE,
  GATE_PATH,
  isExemptPath,
  isGatePath,
  nowSeconds,
  readGateConfig,
  verifyGateCookie,
} from '@/lib/preview-gate';
import { applyRateLimit } from '@/lib/rate-limit';

const gateConfig = readGateConfig(process.env);

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

// Only proxy sees these headers (stripped after).
function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  );
}

// A response that stops the request, or null to let it through.
async function previewGate(request: NextRequest): Promise<NextResponse | null> {
  if (gateConfig.mode === 'off') return null;

  const { pathname, search } = request.nextUrl;
  if (isExemptPath(pathname) || isGatePath(pathname)) return null;

  if (gateConfig.mode === 'misconfigured')
    return new NextResponse('Preview gate is not configured.', {
      status: 503,
      headers: NO_STORE,
    });

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (await verifyGateCookie(gateConfig.password, cookie, nowSeconds()))
    return null;

  const isPageRequest =
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.startsWith('/api/') &&
    !isPrefetch(request);
  if (!isPageRequest)
    return NextResponse.json(
      { error: 'preview_gate' },
      { status: 401, headers: NO_STORE },
    );

  const url = request.nextUrl.clone();
  url.pathname = GATE_PATH;
  url.search = new URLSearchParams({ next: pathname + search }).toString();
  return NextResponse.redirect(url, { headers: NO_STORE });
}

// Layouts own auth redirects; nothing auth-related has to precede rendering.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Runs on prefetches too, or a prefetch header would skip the gate.
  const gated = await previewGate(request);
  if (gated) return gated;

  // Skipped in dev, where every request would land in one 'unknown' bucket,
  // and for prefetches, so speculative Link prefetches don't burn real budget.
  if (process.env.NODE_ENV !== 'development' && !isPrefetch(request)) {
    const limited = applyRateLimit(request);
    if (limited) return limited;
  }

  // Server Components have no direct access to the request URL, so forward the
  // requested path+query on a header — app/(main)/(auth)/layout.tsx reads it to
  // preserve the destination when redirecting nameless users to /login.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'x-current-path',
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Next internals, public assets, and /429 itself must bypass auth + rate limiting.
    '/((?!_next/static|_next/image|favicon.ico|icon|logo-dark.svg|logo-light.svg|apple-icon|sitemap.xml|robots.txt|429).*)',
  ],
};
