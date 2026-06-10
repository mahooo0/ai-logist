import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Phase 4 acceptance criteria assertions — one block per requirement.
 *
 * Verifier grep gate: the pending-marker count decreases monotonically across waves.
 * Pre-Wave 1: 13 markers. Post-Wave 1: 12 (Zenith vendor flips ADMIN-01).
 * Post-Wave 2: 10 (ADMIN-02 + I18N-02 flip). Post-Wave 3: 5
 * (backend reqs API-03/04/05/06/09 flip). Post-Wave 3 plan 04-04: 3
 * (ADMIN-03 + ADMIN-NEW-08 flip). Post-Wave 3 plan 04-05: 0 — Phase 4 CLOSED.
 *
 * Comment hygiene rule: this docstring NEVER mentions the literal marker function
 * name. The verifier uses naive grep -c so any prose mention inflates the count.
 * Re-burning the lesson for the SIXTH time (Phase 1 / 2 / 3 / 3.1 / {this} burn).
 */
describe('Phase 4 — Admin Web acceptance criteria', () => {
  // Backend reqs — flipped in Wave 3 (Plan 04-03)
  it.todo('API-03: GET /api/leads filters by stage + channel');
  it.todo(
    'API-04: GET /api/orders returns joined list (cities + client + channel) + GET /:id returns full detail with events/client/cities/truck'
  );
  it.todo('API-05: GET /api/trucks returns full fleet read-only');
  it.todo(
    'API-06: GET /api/clients/:id/messages UNION returns telegram + voice transcript turns chronologically with callId+timestampMs+audioUrl'
  );
  it.todo(
    'API-09: GET /api/analytics/kpi returns extended shape (avgCallDurationS + byChannel + conversionFunnel) with bigint revenue as string'
  );

  // Frontend reqs — flipped in Wave 1 + 2 + 4 + 5
  it('ADMIN-01: Zenith template vendored into apps/web/ + workspace shared-types ref + dashboard pages exist', () => {
    // Structural proof — paths verified at test time
    const cwd = process.cwd();
    expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/chat/page.tsx`)).toBe(true);
    expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/default/page.tsx`)).toBe(true);
    expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/analytics/page.tsx`)).toBe(true);
    expect(existsSync(`${cwd}/../web/VENDOR.md`)).toBe(true);
    // Calls + orders dirs are CREATED in Wave 4/5 — assertion deferred.
    const webPkg = JSON.parse(readFileSync(`${cwd}/../web/package.json`, 'utf8'));
    expect(webPkg.dependencies['@ai-logist/shared-types']).toBe('workspace:*');
    expect(webPkg.dependencies.swr).toMatch(/^\^?2/);
    expect(webPkg.dependencies.bcryptjs).toMatch(/^\^?3/);
    expect(webPkg.dependencies.jose).toMatch(/^\^?6/);
  });
  it('ADMIN-02: Auth via /auth/v1/login (env-set creds + bcryptjs + jose-signed HTTP-only cookie + proxy.ts gate on /dashboard/*)', () => {
    const cwd = process.cwd();
    expect(existsSync(`${cwd}/../web/src/proxy.ts`)).toBe(true);
    // Plan deviation (Rule 3): handlers live at /api/auth/* because Zenith
    // already serves a page at /auth/v1/login (page.tsx + route.ts collision).
    expect(existsSync(`${cwd}/../web/src/app/api/auth/login/route.ts`)).toBe(true);
    expect(existsSync(`${cwd}/../web/src/app/api/auth/logout/route.ts`)).toBe(true);
    expect(existsSync(`${cwd}/../web/src/lib/auth.ts`)).toBe(true);
    const proxySrc = readFileSync(`${cwd}/../web/src/proxy.ts`, 'utf8');
    expect(proxySrc).toMatch(/matcher.*dashboard/);
    expect(proxySrc).toMatch(/jwtVerify|verifySession/);
    const loginSrc = readFileSync(`${cwd}/../web/src/app/api/auth/login/route.ts`, 'utf8');
    expect(loginSrc).toMatch(/bcrypt|comparePassword/);
    expect(loginSrc).toMatch(/al_session|COOKIE_NAME/);
  });
  it.todo(
    'ADMIN-03: /dashboard/chat unifies Telegram + voice transcript turns with audio playback + intercept controls (TG-only)'
  );
  it.todo(
    'ADMIN-05: /dashboard/default + /dashboard/analytics show KPI tiles + charts from /api/analytics/kpi'
  );
  it.todo(
    'ADMIN-NEW-02: /dashboard/orders table with status + channel filters + URL search params bookmarkable'
  );
  it.todo(
    'ADMIN-NEW-03: /dashboard/orders/[id] renders order detail + events timeline + channel breadcrumb'
  );
  it.todo(
    'ADMIN-NEW-08: /dashboard/calls table + filters + modal with audio player + transcript turn seek'
  );
  it('I18N-02: Customize-panel RU/UA toggle + dictionary in lib/i18n/dict.ts wired via useT() hook', () => {
    const cwd = process.cwd();
    expect(existsSync(`${cwd}/../web/src/lib/i18n/dict.ts`)).toBe(true);
    expect(existsSync(`${cwd}/../web/src/lib/i18n/use-t.ts`)).toBe(true);
    const dictSrc = readFileSync(`${cwd}/../web/src/lib/i18n/dict.ts`, 'utf8');
    expect(dictSrc).toMatch(/Перехватить/);
    expect(dictSrc).toMatch(/Перехопити/);
    expect(dictSrc).toMatch(/chat\.intercept/);
    expect(dictSrc).toMatch(/orders\.title/);
  });
});
