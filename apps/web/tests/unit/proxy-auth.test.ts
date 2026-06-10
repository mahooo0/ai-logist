import { beforeEach, describe, expect, it } from 'vitest';
import { signSession } from '@/lib/auth';

// Mock NextRequest minimal shape used by proxy()
type MockCookies = { get(name: string): { value: string } | undefined };

function makeReq(pathname: string, cookieValue?: string): import('next/server').NextRequest {
  const cookies: MockCookies = {
    get: (name: string) =>
      cookieValue && name === 'al_session' ? { value: cookieValue } : undefined,
  };
  return {
    nextUrl: { pathname },
    url: `http://localhost:3001${pathname}`,
    cookies,
  } as unknown as import('next/server').NextRequest;
}

describe('Phase 4 ADMIN-02 — proxy.ts auth gate', () => {
  beforeEach(() => {
    process.env.AUTH_COOKIE_SECRET = 'a'.repeat(32);
  });

  it('redirects unauth /dashboard/* to /auth/v1/login', async () => {
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/dashboard/default'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/auth\/v1\/login/);
  });

  it('allows authenticated requests through', async () => {
    const token = await signSession({ username: 'admin' });
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/dashboard/default', token));
    // NextResponse.next() returns a non-redirect response — assert no redirect Location
    expect(res.headers.get('location')).toBeNull();
  });

  it('rejects invalid/expired cookie and redirects', async () => {
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/dashboard/default', 'invalid.jwt.token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/auth\/v1\/login/);
  });

  it('matcher config restricts to /dashboard/:path* (excludes /api + /auth)', async () => {
    const { config } = await import('@/proxy');
    expect(config.matcher).toEqual(['/dashboard/:path*']);
    // Static-rules grep guard from Wave 0 also enforces this — belt + suspenders
  });
});
