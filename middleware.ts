import { neonAuthMiddleware } from '@neondatabase/auth/next/server';
import { NextRequest, NextResponse } from 'next/server';

const isBypassActive = process.env.VERCEL_ENV !== 'production';

async function bypassMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Both auth entry points are always reachable on dev so testers can switch modes.
  if (pathname === '/login/bypass' || pathname === '/login')
    return NextResponse.next();

  // A picked bypass role short-circuits real-auth checks.
  if (request.cookies.get('dev-bypass-user-id')) return NextResponse.next();

  // No bypass cookie — honour a real Neon Auth session; redirect the rest to the picker.
  return neonAuthMiddleware({ loginUrl: '/login/bypass' })(request);
}

export default function middleware(request: NextRequest) {
  if (isBypassActive) return bypassMiddleware(request);
  return neonAuthMiddleware({ loginUrl: '/login' })(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
