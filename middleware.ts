import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

const isBypassActive = process.env.VERCEL_ENV !== 'production';

// Public browse routes: the positions list and a single-position detail page.
// The gated sub-paths (/apply, /edit, /applications) are intentionally NOT public.
function isPublicPositionsPath(pathname: string): boolean {
  if (pathname === '/positions') return true;
  // /positions/<id> exactly — but not /positions/<id>/apply|edit|applications.
  return /^\/positions\/[^/]+$/.test(pathname);
}

async function bypassMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Both auth entry points are always reachable on dev so testers can switch modes.
  if (pathname === '/login/bypass' || pathname === '/login')
    return NextResponse.next();

  // Public browse routes pass through without any auth requirement.
  if (isPublicPositionsPath(pathname)) return NextResponse.next();

  // A picked bypass role short-circuits real-auth checks — authenticated users
  // at the root land on the main app dashboard.
  if (request.cookies.get('dev-bypass-user-id')) return NextResponse.next();

  // No bypass cookie — for the root, send anonymous visitors to the positions
  // list rather than the auth picker. For everything else, require auth.
  if (pathname === '/')
    return neonAuthMiddleware({ loginUrl: '/positions' })(request);

  return neonAuthMiddleware({ loginUrl: '/login/bypass' })(request);
}

export default function middleware(request: NextRequest) {
  if (isBypassActive) return bypassMiddleware(request);

  const { pathname } = request.nextUrl;

  // Public browse routes are reachable without authentication in production too.
  if (isPublicPositionsPath(pathname)) return NextResponse.next();

  // Unauthenticated visitors at the root land on the public positions list rather
  // than the login page; authenticated users pass through to the main app dashboard.
  if (pathname === '/')
    return neonAuthMiddleware({ loginUrl: '/positions' })(request);

  return neonAuthMiddleware({ loginUrl: '/login' })(request);
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
