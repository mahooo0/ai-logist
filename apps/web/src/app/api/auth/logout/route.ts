// apps/web/src/app/api/auth/logout/route.ts
// POST /api/auth/logout — clears al_session cookie (D-08).
//
// Same path deviation as login: /api/auth/* lives under the /api/* segment
// that proxy.ts explicitly does NOT intercept.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
