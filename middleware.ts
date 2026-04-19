import { neonAuthMiddleware } from '@neondatabase/auth/next/server';

export default neonAuthMiddleware({ loginUrl: '/auth/login' });

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
