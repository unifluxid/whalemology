import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('stockbit_token')?.value;
  const pathname = request.nextUrl.pathname;

  const PUBLIC_ROUTES = ['/', '/login'];
  const PRIVATE_PREFIXES = ['/dashboard', '/whalemology', '/running-trade'];

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isPrivate = PRIVATE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isPrivate && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
