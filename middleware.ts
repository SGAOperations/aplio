import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

const isBypassActive = process.env.VERCEL_ENV !== 'production';

function bypassMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === '/login/bypass') return NextResponse.next();

  const cookie = request.cookies.get('dev-bypass-user-id');
  if (cookie) return NextResponse.next();

  return NextResponse.redirect(new URL('/login/bypass', request.url));
}

export default function middleware(request: NextRequest) {
  if (isBypassActive) return bypassMiddleware(request);
  return neonAuthMiddleware({ loginUrl: '/login' })(request);
}

export const config = {
  // Exclude Next internals and public metadata/icon assets so the
  // file-convention favicon (/icon.svg) and apple-touch icon (/apple-icon)
  // load on unauthenticated routes instead of being redirected to login.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|sitemap.xml|robots.txt).*)',
  ],
};
