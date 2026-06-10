// apps/web/src/app/api/auth/login/route.ts
// POST /api/auth/login — bcrypt-compare + signed-cookie issuance (D-05/D-06).
//
// Deviation (Rule 3 — blocking): the plan specified the handler at
// /auth/v1/login/route.ts, but Zenith vendors (main)/auth/v1/login/page.tsx
// at that same URL. Next.js forbids a page.tsx + route.ts pair on a single
// segment. Handlers live under /api/auth/* (proxy.ts excludes /api/* so
// unauthenticated requests still reach them). proxy.ts still redirects to
// /auth/v1/login (the page UI).
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { COOKIE_MAX_AGE_S, COOKIE_NAME, comparePassword, signSession } from '@/lib/auth';

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = LoginBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !expectedHash) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  // NOTE: we still run bcrypt.compare even on username mismatch to avoid a
  // trivial timing side-channel that leaks "username exists" vs "password wrong".
  const usernameMatch = username === expectedUsername;
  const ok = await comparePassword(password, expectedHash);
  if (!usernameMatch || !ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await signSession({ username });
  const c = await cookies(); // Next.js 16 — async
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  });

  return NextResponse.json({ ok: true });
}
