// apps/web/src/proxy.ts
// Next.js 16 — renamed from middleware.ts (Pitfall #4).
// Auth gate redirects unauthenticated /dashboard/* requests to /auth/v1/login (Zenith page).
// Source: RESEARCH Pattern 3 + D-06.
import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/auth';

export async function proxy(req: NextRequest) {
  // Defensive: matcher should already exclude /api + /auth, but double-check.
  const p = req.nextUrl.pathname;
  if (!p.startsWith('/dashboard')) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/auth/v1/login', req.url));
  }

  try {
    await verifySession(token);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/auth/v1/login', req.url));
  }
}

// Matcher restricts the proxy to /dashboard/:path* — /api/* + /auth/* are NOT
// intercepted (RESEARCH §Pattern 3 + Pitfall #4 + static-rules guard #4).
export const config = {
  matcher: ['/dashboard/:path*'],
};
