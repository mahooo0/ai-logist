import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/auth';
import { getMockCookieStore, mockCookies } from '../_helpers/mock-cookies';

// NOTE (Plan 04-02 deviation, Rule 3 — blocking issue):
//   The plan specified route handlers at apps/web/src/app/auth/v1/login/route.ts,
//   but Zenith ships (main)/auth/v1/login/page.tsx serving the SAME URL /auth/v1/login.
//   Next.js forbids a route.ts + page.tsx pair at the same URL segment.
//   Routes therefore live at /api/auth/login and /api/auth/logout (proxy.ts already
//   excludes /api, so unauthenticated requests still reach them). proxy.ts still
//   redirects to /auth/v1/login (the page UI). Login form posts to /api/auth/login.

describe('Phase 4 ADMIN-02 — POST /api/auth/login', () => {
  beforeEach(async () => {
    process.env.AUTH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD_HASH = await hashPassword('correctpw');
    mockCookies();
  });
  afterEach(() => {
    vi.resetModules();
  });

  function makeReq(body: unknown): import('next/server').NextRequest {
    return {
      json: async () => body,
    } as unknown as import('next/server').NextRequest;
  }

  it('returns 200 + sets al_session cookie on valid creds', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(makeReq({ username: 'admin', password: 'correctpw' }));
    expect(res.status).toBe(200);
    expect(getMockCookieStore().has('al_session')).toBe(true);
  });

  it('returns 401 on bad password', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(makeReq({ username: 'admin', password: 'wrong' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_credentials');
  });

  it('returns 401 on bad username (constant-time-ish)', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(makeReq({ username: 'wrong', password: 'correctpw' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(makeReq({ username: '' }));
    expect(res.status).toBe(400);
  });
});

describe('Phase 4 ADMIN-02 — POST /api/auth/logout', () => {
  beforeEach(() => {
    mockCookies({ al_session: 'some.token.value' });
  });

  it('clears al_session cookie', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    expect(getMockCookieStore().has('al_session')).toBe(false);
  });
});
