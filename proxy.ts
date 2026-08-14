import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

import { applyRateLimit } from '@/lib/rate-limit';

// Layouts own auth redirects; only the OAuth token exchange must precede rendering.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Skipped in dev, where every request would land in one 'unknown' bucket.
  if (process.env.NODE_ENV !== 'development') {
    const limited = applyRateLimit(request);
    if (limited) return limited;
  }

  if (request.nextUrl.searchParams.has('neon_auth_session_verifier'))
    return neonAuthMiddleware({ loginUrl: '/login' })(request);

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
  // Next internals and public assets must load without redirecting to login.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|logo-dark.svg|logo-light.svg|apple-icon|sitemap.xml|robots.txt).*)',
  ],
};
