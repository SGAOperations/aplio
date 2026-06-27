import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

// Auth redirects are owned by layouts: app/(main)/(auth)/layout.tsx redirects
// unauthenticated visitors to /login (prod) or /login/bypass (dev) via getCurrentUser().
// Middleware only handles the Neon OAuth callback — the token exchange must run before
// any page renders, but only fires when the verifier param is present.
export default function middleware(request: NextRequest) {
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
