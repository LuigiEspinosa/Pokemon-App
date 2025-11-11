import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware guard for basic auth-aware routing.
 *
 * Logic:
 * - If no "is-logged" cookie and path is not /login => redirect to /login.
 * - If "is-logged" is present and path is /login => redirect to home.
 *
 * Notes:
 * - This is a UX convenience; final authorization should still be enforced server-side.
 */
export function proxy(req: NextRequest) {
  const isLogged = req.cookies.get('is-logged');
  const isLogin = req.nextUrl.pathname.startsWith('/login');

  if (!isLogged && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isLogged && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] };
