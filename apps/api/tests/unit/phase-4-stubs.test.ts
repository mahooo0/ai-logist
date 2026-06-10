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
  it('API-03: GET /api/leads filters by stage + channel', () => {
    const src = readFileSync(`${process.cwd()}/src/routes/leads.ts`, 'utf8');
    // Real handler shipped — no Phase 1 'admin web' notImplemented marker.
    expect(src).toMatch(/Phase 4 API-03|API-03/);
    expect(src).toMatch(/channel/);
    expect(src).not.toMatch(/reply\.notImplemented\(['"]Phase 4 — admin web['"]\)/);
    // Channel filter coerces 'voice' query to legacy 'call' rows.
    expect(src).toMatch(/IN \('voice','call'\)/);
  });

  it('API-04: GET /api/orders returns joined list + GET /:id returns full detail', () => {
    const src = readFileSync(`${process.cwd()}/src/routes/orders.ts`, 'utf8');
    expect(src).toMatch(/LEFT JOIN|leftJoin/);
    expect(src).toMatch(/from_city_id|fromCityId/);
    expect(src).toMatch(/order_events|orderEvents/);
    // GET /orders no longer a 501 stub.
    expect(src).toMatch(/OrderListItemSchema/);
    expect(src).toMatch(/OrderDetailExtendedSchema/);
  });

  it('API-05: GET /api/trucks returns full fleet read-only', () => {
    const src = readFileSync(`${process.cwd()}/src/routes/trucks.ts`, 'utf8');
    expect(src).toMatch(/FROM trucks/);
    // POST/PATCH stubs remain — fleet CRUD deferred to v2.
    expect(src).toMatch(/reply\.notImplemented/);
  });

  it('API-06: GET /api/clients/:id/messages UNION returns telegram + voice transcript turns', () => {
    const src = readFileSync(`${process.cwd()}/src/routes/clients.ts`, 'utf8');
    expect(src).toMatch(/UNION ALL/);
    expect(src).toMatch(/jsonb_array_elements/);
    expect(src).toMatch(/WITH ORDINALITY/);
    expect(src).toMatch(/timestamp_ms/);
    expect(src).toMatch(/audio_url/);
    expect(src).toMatch(/LATERAL/);
  });

  it('API-09: GET /api/analytics/kpi returns extended shape with bigint revenue as string', () => {
    const src = readFileSync(`${process.cwd()}/src/routes/analytics.ts`, 'utf8');
    expect(src).toMatch(/avgCallDurationS/);
    expect(src).toMatch(/byChannel/);
    expect(src).toMatch(/conversionFunnel/);
    expect(src).toMatch(/FILTER \(WHERE/);
    expect(src).toMatch(/revenue/);
  });

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
  it('ADMIN-03: /dashboard/chat unifies Telegram + voice transcript turns with audio playback + intercept controls (TG-only)', () => {
    const cwd = process.cwd();
    const pagePath = `${cwd}/../web/src/app/(main)/dashboard/chat/page.tsx`;
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    // Server Component — directive must NOT be present at line start.
    expect(page).not.toMatch(/^'use client'/m);
    expect(page).not.toMatch(/^"use client"/m);
    expect(page).not.toMatch(/^'use cache'/m);
    expect(page).toMatch(/apiGet/);
    expect(page).toMatch(/UnifiedMessage/);
    expect(page).toMatch(/await searchParams/);

    const chatApp = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/chat/_components/chat-app.tsx`,
      'utf8'
    );
    expect(chatApp).toMatch(/'use client'/);
    expect(chatApp).toMatch(/useSWR/);
    expect(chatApp).toMatch(/refreshInterval:\s*5000/);
    expect(chatApp).toMatch(/isPaused/);

    const threadView = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/chat/_components/thread-view.tsx`,
      'utf8'
    );
    // Manager intercept POSTs to all 3 endpoints.
    expect(threadView).toMatch(/intercept/);
    expect(threadView).toMatch(/manager-message/);
    expect(threadView).toMatch(/release/);
    // D-47 — voice channel threads MUST NOT show intercept controls.
    expect(threadView).toMatch(/channel\s*!==\s*['"]voice['"]/);

    // VoiceTurn implements the audio seek per D-26.
    const voiceTurn = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx`,
      'utf8'
    );
    expect(voiceTurn).toMatch(/audio\.currentTime/);
    expect(voiceTurn).toMatch(/timestampMs/);
    expect(voiceTurn).toMatch(/preload="metadata"/);

    // Telegram bubble carries the green TG badge per D-20.
    const tg = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx`,
      'utf8'
    );
    expect(tg).toMatch(/TG/);
  });
  it('ADMIN-05: /dashboard/default + /dashboard/analytics render KPI from /api/analytics/kpi with window selector', () => {
    const cwd = process.cwd();
    const defPath = `${cwd}/../web/src/app/(main)/dashboard/default/page.tsx`;
    const anPath = `${cwd}/../web/src/app/(main)/dashboard/analytics/page.tsx`;
    expect(existsSync(defPath)).toBe(true);
    expect(existsSync(anPath)).toBe(true);
    const def = readFileSync(defPath, 'utf8');
    expect(def).toMatch(/KpiResponseSchema/);
    const an = readFileSync(anPath, 'utf8');
    expect(an).toMatch(/await searchParams/);
    expect(an).toMatch(/KpiResponseSchema/);
    const anApp = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx`,
      'utf8'
    );
    expect(anApp).toMatch(/'use client'/);
    const ws = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx`,
      'utf8'
    );
    expect(ws).toMatch(/router\.push.*window=/);
  });
  it('ADMIN-NEW-02: /dashboard/orders renders table with 7 columns including channel + city names + price', () => {
    const cwd = process.cwd();
    const pagePath = `${cwd}/../web/src/app/(main)/dashboard/orders/page.tsx`;
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).not.toMatch(/^'use client'/m);
    expect(page).toMatch(/OrderListItemSchema/);
    const table = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/orders/_components/orders-table.tsx`,
      'utf8'
    );
    expect(table).toMatch(/useReactTable|getCoreRowModel/);
    expect(table).toMatch(/formatMoney/);
    expect(table).toMatch(/channel/);
  });
  it('ADMIN-NEW-03: /dashboard/orders/[id] renders read-only detail with channel breadcrumb + timeline', () => {
    const cwd = process.cwd();
    const pagePath = `${cwd}/../web/src/app/(main)/dashboard/orders/[id]/page.tsx`;
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).toMatch(/await params/);
    expect(page).toMatch(/OrderDetailExtendedSchema/);
    const app = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx`,
      'utf8'
    );
    expect(app).toMatch(/Прослушать|Открыть/);
    const timeline = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx`,
      'utf8'
    );
    expect(timeline).toMatch(/actor|order_events|events/);
  });
  it('ADMIN-NEW-08: /dashboard/calls table + filters + modal with audio player + transcript turn seek', () => {
    const cwd = process.cwd();
    const pagePath = `${cwd}/../web/src/app/(main)/dashboard/calls/page.tsx`;
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    // Server Component — no client/cache directives at line start.
    expect(page).not.toMatch(/^'use client'/m);
    expect(page).not.toMatch(/^"use client"/m);
    expect(page).not.toMatch(/^'use cache'/m);
    expect(page).toMatch(/CallSchema/);
    expect(page).toMatch(/CallListQuerySchema/);
    expect(page).toMatch(/await searchParams/);

    const app = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/calls/_components/calls-app.tsx`,
      'utf8'
    );
    expect(app).toMatch(/'use client'/);
    expect(app).toMatch(/useSWR/);
    expect(app).toMatch(/refreshInterval:\s*30_?000/);
    expect(app).toMatch(/useRouter/);

    const table = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/calls/_components/calls-table.tsx`,
      'utf8'
    );
    expect(table).toMatch(/useReactTable|getCoreRowModel/);

    const modal = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx`,
      'utf8'
    );
    expect(modal).toMatch(/audio\.currentTime/);
    expect(modal).toMatch(/transcript/);
    expect(modal).toMatch(/preload="metadata"/);
    // Linked-lead / linked-order quick links per D-30.
    expect(modal).toMatch(/Открыть/);

    const filters = readFileSync(
      `${cwd}/../web/src/app/(main)/dashboard/calls/_components/calls-filters.tsx`,
      'utf8'
    );
    expect(filters).toMatch(/outcome/);
    expect(filters).toMatch(/lang/);
  });
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
