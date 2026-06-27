import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

import { applyRateLimit } from '@/lib/rate-limit';

// Auth redirects are owned by layouts: app/(main)/(auth)/layout.tsx redirects
// unauthenticated visitors to /login (prod) or /login/bypass (dev) via getCurrentUser().
// Middleware only handles the Neon OAuth callback — the token exchange must run before
// any page renders, but only fires when the verifier param is present.
export function proxy(request: NextRequest): NextResponse {
  // Rate limiting only applies outside development: in dev there is no proxy to set
  // x-forwarded-for/x-real-ip, so every request maps to 'unknown' and all local
  // traffic to a capped route would share one bucket.
  if (process.env.NODE_ENV !== 'development') {
    const limited = applyRateLimit(request);
    if (limited) return limited;
  }

  if (request.nextUrl.searchParams.has('neon_auth_session_verifier'))
    return neonAuthMiddleware({ loginUrl: '/login' })(request);

  return NextResponse.next();
}

export const config = {
  // Exclude Next internals, public metadata/icon assets, and static images so
  // they load on unauthenticated routes without being redirected to login.
  // `icon` matches any path starting with /icon (e.g. static icon files);
  // `apple-icon` covers app/apple-icon.tsx similarly.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|logo-dark.svg|logo-light.svg|apple-icon|sitemap.xml|robots.txt).*)',
  ],
};
