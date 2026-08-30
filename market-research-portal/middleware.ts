import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from './src/lib/session-auth';

// Lightweight presence-only gate (Edge runtime can't hold a pg Pool) —
// every API route additionally calls requireAdmin() in Node runtime for
// the real DB-backed session check. This middleware exists so an
// unauthenticated browser gets redirected to /login instead of a blank
// page, and an unauthenticated API caller gets a fast 401 without a DB
// round-trip for the common case of "no cookie at all".
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
