import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/appointments',
  '/queue',
  '/medical-records',
  '/notifications',
  '/settings',
];

/**
 * Coarse, cookie-presence-only gate. The web app never holds the JWT signing secret, so this
 * can't validate the token — it only avoids flashing protected UI before the client-side
 * `useAuth()` check (and the API's own `authenticate` middleware) can run. Treat this as a UX
 * nicety, not the authorization boundary.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !request.cookies.has('refreshToken')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/appointments/:path*', '/queue/:path*', '/medical-records/:path*', '/notifications/:path*', '/settings/:path*'],
};
