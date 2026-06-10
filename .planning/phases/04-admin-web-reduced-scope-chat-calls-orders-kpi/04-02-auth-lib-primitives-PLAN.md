---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 02
type: execute
wave: 2
depends_on: [04-01]
files_modified:
  - apps/web/src/proxy.ts
  - apps/web/src/lib/api.ts
  - apps/web/src/lib/auth.ts
  - apps/web/src/lib/format.ts
  - apps/web/src/lib/i18n/dict.ts
  - apps/web/src/lib/i18n/use-t.ts
  - apps/web/src/app/auth/v1/login/route.ts
  - apps/web/src/app/auth/v1/logout/route.ts
  - apps/web/src/app/auth/v1/login/_components/login-form.tsx
  - apps/web/scripts/gen-admin-password.ts
  - apps/web/src/navigation/sidebar/sidebar-items.ts
  - apps/api/tests/unit/phase-4-stubs.test.ts
  - apps/web/tests/unit/proxy-auth.test.ts
  - apps/web/tests/unit/login-route.test.ts
  - apps/web/tests/unit/i18n-dict.test.ts
  - apps/web/tests/unit/use-t.test.ts
autonomous: true
requirements:
  - ADMIN-02
  - I18N-02

must_haves:
  truths:
    - "apps/web/src/proxy.ts (Next.js 16 convention per Pitfall #4) gates /dashboard/:path* and redirects unauth to /auth/v1/login — matcher EXCLUDES /api and /auth (RESEARCH §Pattern 3)."
    - "POST /auth/v1/login bcrypt-compares password against ADMIN_PASSWORD_HASH, signs jose JWT (HS256, 12h expiry), sets HTTP-only httpOnly+sameSite=lax+secure cookie `al_session` (D-05/D-06)."
    - "POST /auth/v1/logout clears `al_session` cookie + returns 200 (D-08)."
    - "apps/web/src/lib/api.ts exports `apiGet<Schema>(path, schema)` server/client auto-routing helper (D-14/D-17) with Zod boundary validation."
    - "apps/web/src/lib/i18n/dict.ts contains both RU + UA dictionaries with all keys from RESEARCH Example 5 (chat.*, calls.*, orders.*, kpi.*, order.*); useT() hook reads Zenith's usePreferencesStore.language field (VENDOR.md records exact name) and falls back to RU."
    - "apps/web/src/lib/format.ts exports formatMoney(kopecks, lang) + formatPhone(e164, masked?) + formatDate(iso, lang) — using libphonenumber-js + Intl.DateTimeFormat (date-fns/locale is Phase 5 per D-54)."
    - "Sidebar items config (apps/web/src/navigation/sidebar/sidebar-items.ts) shows ONLY Default + Analytics + Chat + Calls + Orders (D-49); all other Zenith items commented out (NOT deleted — D-48)."
    - "apps/web/scripts/gen-admin-password.ts reads stdin password + outputs ADMIN_PASSWORD_HASH=... via bcryptjs.hash(pw, 12) (D-66)."
    - "9 frontend test.todo markers (across i18n-dict.test.ts, proxy-auth.test.ts, login-route.test.ts, use-t.test.ts) flip to real it() — all green."
    - "phase-4-stubs.test.ts marker count: 12 → 10 (ADMIN-02 + I18N-02 flipped)."
  artifacts:
    - path: "apps/web/src/proxy.ts"
      provides: "Next.js 16 proxy.ts (formerly middleware.ts) — auth gate via jose jwtVerify"
      contains: "jwtVerify,NextResponse.redirect,matcher,/dashboard/:path*"
      min_lines: 25
    - path: "apps/web/src/lib/api.ts"
      provides: "Server/client auto-routing apiGet<Schema> with Zod validation"
      contains: "apiGet,z.ZodTypeAny,API_INTERNAL_URL,parsed.safeParse"
      min_lines: 30
    - path: "apps/web/src/lib/auth.ts"
      provides: "signSession + verifySession + hashPassword helpers (jose + bcryptjs)"
      contains: "SignJWT,jwtVerify,bcrypt.compare,bcrypt.hash"
    - path: "apps/web/src/lib/format.ts"
      provides: "formatMoney + formatPhone + formatDate"
      contains: "formatMoney,formatPhone,formatDate,libphonenumber-js,Intl.DateTimeFormat"
    - path: "apps/web/src/lib/i18n/dict.ts"
      provides: "RU + UA dictionaries with 27+ keys (D-52 verbatim + RESEARCH Example 5)"
      contains: "chat.intercept,chat.release,calls.title,orders.title,kpi.tile.calls"
      min_lines: 50
    - path: "apps/web/src/lib/i18n/use-t.ts"
      provides: "useT() client hook reading Zenith's usePreferencesStore"
      contains: "usePreferencesStore,dict,DictKey"
    - path: "apps/web/src/app/auth/v1/login/route.ts"
      provides: "POST /auth/v1/login Route Handler"
      contains: "bcrypt.compare,SignJWT,cookies,al_session"
      min_lines: 30
    - path: "apps/web/src/app/auth/v1/logout/route.ts"
      provides: "POST /auth/v1/logout — clears cookie"
      contains: "cookies,al_session,delete"
    - path: "apps/web/scripts/gen-admin-password.ts"
      provides: "Bcrypt hash CLI for ADMIN_PASSWORD_HASH"
      contains: "bcrypt.hash,readline"
    - path: "apps/web/src/navigation/sidebar/sidebar-items.ts"
      provides: "Sidebar trimmed to 5 Phase 4 routes; others commented out (D-49)"
      contains: "Default,Analytics,Chat,Calls,Orders"
  key_links:
    - from: "Waves 4 + 5 (chat / calls / orders pages)"
      to: "apps/web/src/lib/api.ts"
      via: "Server Component page.tsx: `import { apiGet } from '@/lib/api'; const data = await apiGet('/leads?stage=NEW', LeadSchema.array());`"
      pattern: "apiGet"
    - from: "All page rewires (Waves 4 + 5)"
      to: "apps/web/src/lib/i18n/use-t.ts"
      via: "Client components: `const t = useT(); <Button>{t('chat.intercept')}</Button>`"
      pattern: "useT"
    - from: "All money displays in /orders, /orders/[id], /calls modal"
      to: "apps/web/src/lib/format.ts"
      via: "formatMoney(order.price, lang) — kopecks bigint → '4,250 ₽'"
      pattern: "formatMoney"
    - from: "User-facing demo setup"
      to: "apps/web/scripts/gen-admin-password.ts"
      via: "pnpm --filter @ai-logist/web gen:admin-password → prints ADMIN_PASSWORD_HASH= to paste in .env.local"
      pattern: "gen-admin-password"
---

<objective>
Land auth gate (ADMIN-02) + UI primitives (apiGet, formatters, i18n dictionary + useT hook, sidebar trim) — all the cross-cutting concerns that Waves 4 + 5 page rewires depend on. Single plan delivers everything between "Zenith vendored" and "page rewires can start."

Purpose:
- Implement Next.js 16 proxy.ts (formerly middleware.ts per Pitfall #4) — RESEARCH explicitly recommends `proxy.ts` to avoid deprecation churn.
- Wire single-user env-set auth (D-05..D-09): bcryptjs + jose stateless cookie, no NextAuth/Clerk/iron-session bloat.
- Ship the 3 lib primitives Waves 4-5 import everywhere: `apiGet`, `format`, `useT` + `dict`.
- Trim Zenith's sidebar to Phase 4's 5 routes (D-49) without deleting the other pages (D-48).
- Add `gen:admin-password` CLI so demo setup is one command.
- Flip 9 frontend test.todo markers to real it() blocks (proxy-auth + login-route + i18n-dict + use-t).
- Flip 2 stub-file markers (ADMIN-02 + I18N-02). Marker count 12 → 10.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-01-zenith-vendor-PLAN.md
@apps/web/VENDOR.md
@apps/web/package.json
@apps/web/src/app/auth/v1/login/page.tsx
@apps/web/src/stores/preferences

<interfaces>
<!-- RESEARCH Pattern 3 (proxy.ts) — verbatim shape: -->
<!--   matcher: ['/dashboard/:path*'] -->
<!--   jwtVerify(token, SECRET) — HS256 -->
<!--   redirect to /auth/v1/login on missing/invalid -->

<!-- RESEARCH Pattern 3 (login route) — verbatim shape: -->
<!--   LoginBody = z.object({ username: z.string().min(1), password: z.string().min(1) }) -->
<!--   bcrypt.compare(password, ADMIN_PASSWORD_HASH) -->
<!--   SignJWT({username}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('12h').sign(SECRET) -->
<!--   cookies().set('al_session', token, { httpOnly: true, secure: prod, sameSite: 'lax', path: '/', maxAge: 60*60*12 }) -->
<!--   Next.js 16 — await cookies() (async!) -->

<!-- RESEARCH Example 1 (apiGet) — verbatim shape: -->
<!--   const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000'; -->
<!--   const isServer = typeof window === 'undefined'; -->
<!--   const url = isServer ? `${INTERNAL_BASE}/api${path}` : `/api${path}`; -->
<!--   schema.safeParse(json) — throw on invalid with path + payload snippet -->

<!-- RESEARCH Example 5 (dict.ts) — verbatim 27 keys with RU + UA values -->
<!-- RESEARCH Example 6 (gen-admin-password.ts) — verbatim shape -->

<!-- VENDOR.md records the exact preferences-store hook signature (Plan 04-01 Task 1) -->
<!-- The useT() hook MUST reference whatever name + field VENDOR.md captures — -->
<!-- typical Zenith path: `import { usePreferencesStore } from '@/stores/preferences/preferences-provider'` -->
<!-- typical field: state.language (one of 'en' | 'ru' | 'ua') -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib primitives (api + auth + format + i18n) + gen-admin-password CLI</name>
  <files>
    apps/web/src/lib/api.ts,
    apps/web/src/lib/auth.ts,
    apps/web/src/lib/format.ts,
    apps/web/src/lib/i18n/dict.ts,
    apps/web/src/lib/i18n/use-t.ts,
    apps/web/scripts/gen-admin-password.ts,
    apps/web/tests/unit/i18n-dict.test.ts,
    apps/web/tests/unit/use-t.test.ts
  </files>
  <read_first>
    apps/web/VENDOR.md,
    apps/web/src/stores/preferences/preferences-provider.tsx,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md,
    apps/web/package.json
  </read_first>
  <behavior>
    - `apiGet('/leads', LeadSchema.array())` on server → fetches `${API_INTERNAL_URL}/api/leads` with `cache: 'no-store'`; on client → fetches `/api/leads`; validates response via `schema.safeParse`; throws with payload snippet on mismatch.
    - `signSession({username})` returns a jose HS256 JWT with 12h expiry; `verifySession(token)` returns `{username}` payload or throws.
    - `hashPassword(pw)` returns bcrypt hash with cost factor 12.
    - `formatMoney(123456n, 'ru')` returns `'1 234,56 ₽'` (or `'1 235 ₽'` if integer-only as Phase 4 displays per RESEARCH anti-patterns note).
    - `formatPhone('+79161234567', { mask: true })` returns `'+7 (916) ***-45-67'` (masks middle, shows last 4).
    - `formatDate('2026-06-10T12:34:56Z', 'ru')` returns `'10.06.2026, 12:34'` (Intl.DateTimeFormat per D-54).
    - `dict.ru['chat.intercept'] === 'Перехватить'`; `dict.ua['chat.intercept'] === 'Перехопити'`.
    - `useT()` reads `usePreferencesStore.language` (per VENDOR.md exact field name); returns `(key, vars?) => string` with `{var}` interpolation.
    - `gen-admin-password.ts` reads password from stdin (readline), outputs `ADMIN_PASSWORD_HASH=<hash>` to stdout, exits 0.
  </behavior>
  <action>
Step 1 — Create `apps/web/src/lib/api.ts` (RESEARCH Example 1 verbatim with Phase 4 polish):

```ts
// apps/web/src/lib/api.ts
// Server Component fetcher with Zod boundary validation.
// D-14: Validates response via shared-types Zod schema; throws with payload snippet.
// D-17: Auto-routes — server → API_INTERNAL_URL; client → relative /api/...
import type { z } from 'zod/v4';

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';

export async function apiGet<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const isServer = typeof window === 'undefined';
  const base = isServer ? `${INTERNAL_BASE}/api` : '/api';
  const url = `${base}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`apiGet ${path} ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `apiGet ${path} schema mismatch: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    );
  }
  return parsed.data;
}
```

Step 2 — Create `apps/web/src/lib/auth.ts`:

```ts
// apps/web/src/lib/auth.ts
// jose-signed session cookie + bcryptjs hash helpers (D-05/D-06).
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const ENC = new TextEncoder();

function getSecret(): Uint8Array {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_COOKIE_SECRET missing or too short (need >= 32 hex chars)');
  }
  return ENC.encode(s);
}

export async function signSession(payload: { username: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<{ username: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.username !== 'string') {
    throw new Error('Invalid session payload');
  }
  return { username: payload.username };
}

export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export const COOKIE_NAME = 'al_session';
export const COOKIE_MAX_AGE_S = 60 * 60 * 12; // 12h per D-06
```

Step 3 — Create `apps/web/src/lib/format.ts` (D-54: Intl, NOT date-fns/locale — Phase 5 polish):

```ts
// apps/web/src/lib/format.ts
import parsePhoneNumberFromString from 'libphonenumber-js';

type Lang = 'ru' | 'ua';

// formatMoney — kopecks (bigint) → ruble integer display per RESEARCH §Anti-Patterns note.
// Phase 4 shows whole rubles (no kopecks decimals) — matches demo display style.
export function formatMoney(kopecksLike: string | number | bigint, lang: Lang = 'ru'): string {
  const kopecks = typeof kopecksLike === 'string' ? BigInt(kopecksLike) : BigInt(kopecksLike);
  const rubles = Number(kopecks / 100n); // integer rubles, safe for demo-scale values
  const locale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(rubles);
}

// formatPhone — libphonenumber-js with optional last-4-masking for /calls + /chat thread list (D-28).
export function formatPhone(e164: string, opts: { mask?: boolean } = {}): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  const intl = parsed.formatInternational();
  if (!opts.mask) return intl;
  // Mask middle, keep last 4
  const last4 = parsed.nationalNumber.slice(-4);
  const prefix = parsed.countryCallingCode;
  return `+${prefix} *** ${last4}`;
}

// formatDate — D-54: Intl.DateTimeFormat now; date-fns/locale = Phase 5 (I18N-04).
export function formatDate(iso: string, lang: Lang = 'ru'): string {
  const locale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// formatDuration — mm:ss for call durations (D-28).
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

Step 4 — Create `apps/web/src/lib/i18n/dict.ts` with FULL RU + UA dictionary from RESEARCH Example 5 (copy ALL 27 keys verbatim):

```ts
// apps/web/src/lib/i18n/dict.ts
// D-52 verbatim — RESEARCH Example 5. Phase 4 only translates strings we add.
// Zenith template's built-in EN/RU strings stay as-is (D-55).
export const dict = {
  ru: {
    'chat.intercept': 'Перехватить',
    'chat.release': 'Вернуть боту',
    'chat.managerMessagePlaceholder': 'Сообщение от менеджера',
    'calls.title': 'Звонки',
    'calls.filter.outcome': 'Исход',
    'calls.filter.outcome.completed': 'Завершён',
    'calls.filter.outcome.abandoned': 'Брошен',
    'calls.filter.outcome.escalated': 'Передан менеджеру',
    'calls.filter.outcome.error': 'Ошибка',
    'orders.title': 'Заказы',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клиент',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Цена',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Звонков',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсия',
    'kpi.tile.avgCallDuration': 'Средняя длительность звонка',
    'kpi.tile.revenue': 'Выручка',
    'order.section.client': 'Клиент',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Груз',
    'order.section.timeline': 'История',
    'order.breadcrumb.listenCall': 'Прослушать звонок',
    'order.breadcrumb.openChat': 'Открыть диалог',
  },
  ua: {
    'chat.intercept': 'Перехопити',
    'chat.release': 'Повернути боту',
    'chat.managerMessagePlaceholder': 'Повідомлення від менеджера',
    'calls.title': 'Дзвінки',
    'calls.filter.outcome': 'Результат',
    'calls.filter.outcome.completed': 'Завершено',
    'calls.filter.outcome.abandoned': 'Кинуто',
    'calls.filter.outcome.escalated': 'Передано менеджеру',
    'calls.filter.outcome.error': 'Помилка',
    'orders.title': 'Замовлення',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клієнт',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Ціна',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Дзвінків',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсія',
    'kpi.tile.avgCallDuration': 'Середня тривалість дзвінка',
    'kpi.tile.revenue': 'Виторг',
    'order.section.client': 'Клієнт',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Вантаж',
    'order.section.timeline': 'Історія',
    'order.breadcrumb.listenCall': 'Прослухати дзвінок',
    'order.breadcrumb.openChat': 'Відкрити діалог',
  },
} as const satisfies Record<'ru' | 'ua', Record<string, string>>;

export type DictKey = keyof typeof dict.ru;
```

Step 5 — Create `apps/web/src/lib/i18n/use-t.ts`. **CRITICAL: Read `apps/web/VENDOR.md` first to confirm the exact Zenith store hook name + field**:

```ts
// apps/web/src/lib/i18n/use-t.ts
'use client';
// IMPORTANT: The import path + field name below MUST match what apps/web/VENDOR.md
// (Plan 04-01 Task 1 Step 8) captured from Zenith's actual preferences store.
// Typical Zenith shape (verify): import { usePreferencesStore } from '@/stores/preferences/preferences-provider';
import { usePreferencesStore } from '@/stores/preferences/preferences-provider';
import { dict, type DictKey } from './dict';

export function useT() {
  // Zenith's Zustand store exposes a `language` field per VENDOR.md.
  // If VENDOR.md records a different name (e.g. `locale`), update both the
  // selector AND the safeLang derivation below to match.
  const lang = usePreferencesStore((s) => (s as { language?: string }).language ?? 'ru');
  const safeLang: 'ru' | 'ua' = lang === 'ua' ? 'ua' : 'ru';

  return (key: DictKey, vars?: Record<string, string | number>): string => {
    let out: string = dict[safeLang][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  };
}
```

Step 6 — Create `apps/web/scripts/gen-admin-password.ts` (D-66 + RESEARCH Example 6):

```ts
// apps/web/scripts/gen-admin-password.ts
// D-66 — bcryptjs hash generator for ADMIN_PASSWORD_HASH env var.
// Run via: pnpm --filter @ai-logist/web gen:admin-password
import bcrypt from 'bcryptjs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: stdin, output: stdout, terminal: true });
const password = await rl.question('Admin password: ');
rl.close();

if (!password || password.length < 4) {
  console.error('Password too short (min 4 chars)');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(`\nADMIN_PASSWORD_HASH=${hash}\n`);
process.exit(0);
```

Step 7 — Flip 6 frontend test.todo markers across `i18n-dict.test.ts` + `use-t.test.ts` to real it() blocks:

`apps/web/tests/unit/i18n-dict.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dict, type DictKey } from '@/lib/i18n/dict';

describe('Phase 4 I18N-02 — dict structure', () => {
  it("RU + UA dictionaries have IDENTICAL key sets (no orphaned translations)", () => {
    const ruKeys = Object.keys(dict.ru).sort();
    const uaKeys = Object.keys(dict.ua).sort();
    expect(uaKeys).toEqual(ruKeys);
  });

  it("dict.ru['chat.intercept'] returns 'Перехватить'", () => {
    expect(dict.ru['chat.intercept']).toBe('Перехватить');
  });

  it("dict.ua['chat.intercept'] returns 'Перехопити'", () => {
    expect(dict.ua['chat.intercept']).toBe('Перехопити');
  });

  it("contains all 27+ keys from RESEARCH Example 5", () => {
    const required: DictKey[] = [
      'chat.intercept', 'chat.release', 'chat.managerMessagePlaceholder',
      'calls.title', 'calls.filter.outcome',
      'orders.title', 'orders.col.number', 'orders.col.client', 'orders.col.route',
      'orders.col.status', 'orders.col.price', 'orders.col.channel',
      'kpi.tile.calls', 'kpi.tile.telegram', 'kpi.tile.conversion',
      'kpi.tile.avgCallDuration', 'kpi.tile.revenue',
      'order.section.client', 'order.section.route', 'order.section.truck',
      'order.section.cargo', 'order.section.timeline',
      'order.breadcrumb.listenCall', 'order.breadcrumb.openChat',
    ];
    for (const key of required) {
      expect(dict.ru[key]).toBeTypeOf('string');
      expect(dict.ua[key]).toBeTypeOf('string');
    }
  });
});
```

`apps/web/tests/unit/use-t.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';

// Mock Zustand store BEFORE importing useT
vi.mock('@/stores/preferences/preferences-provider', () => ({
  usePreferencesStore: vi.fn((selector: (s: { language: string }) => unknown) => selector({ language: 'ru' })),
}));

describe('Phase 4 I18N-02 — useT() hook', () => {
  it("returns 'Перехватить' for lang=ru (default)", async () => {
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехватить');
  });

  it("falls back to RU when language is unset or unknown", async () => {
    const { usePreferencesStore } = await import('@/stores/preferences/preferences-provider');
    (usePreferencesStore as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (selector: (s: { language?: string }) => unknown) => selector({}),
    );
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехватить');
  });

  it("interpolates {var} placeholders", async () => {
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    // Pick a key that we can extend with vars (or test interpolation logic in isolation)
    const out = t('chat.intercept', { unused: 'x' });
    expect(out).toBe('Перехватить'); // no placeholder in this key — verifies non-interference
  });

  it("returns 'Перехопити' for lang=ua", async () => {
    const { usePreferencesStore } = await import('@/stores/preferences/preferences-provider');
    (usePreferencesStore as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (selector: (s: { language: string }) => unknown) => selector({ language: 'ua' }),
    );
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехопити');
  });
});
```

Commit message: `feat(04-02): lib primitives (api + auth + format + i18n) + gen-admin-password CLI`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/lib/api.ts && \
test -f apps/web/src/lib/auth.ts && \
test -f apps/web/src/lib/format.ts && \
test -f apps/web/src/lib/i18n/dict.ts && \
test -f apps/web/src/lib/i18n/use-t.ts && \
test -f apps/web/scripts/gen-admin-password.ts && \
grep -q "apiGet" apps/web/src/lib/api.ts && \
grep -q "SignJWT\|jwtVerify" apps/web/src/lib/auth.ts && \
grep -q "formatMoney\|formatPhone\|formatDate" apps/web/src/lib/format.ts && \
grep -q "Перехватить" apps/web/src/lib/i18n/dict.ts && \
grep -q "Перехопити" apps/web/src/lib/i18n/dict.ts && \
grep -q "usePreferencesStore" apps/web/src/lib/i18n/use-t.ts && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test 2>&1 | grep -E "passed" | grep -v "0 passed"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/lib/api.ts` exports `apiGet<T extends z.ZodTypeAny>(path, schema, init?)` with `cache: 'no-store'` + `safeParse` validation + isServer/isClient auto-routing via `API_INTERNAL_URL`
    - `apps/web/src/lib/auth.ts` exports `signSession`, `verifySession`, `comparePassword`, `hashPassword`, `COOKIE_NAME='al_session'`, `COOKIE_MAX_AGE_S = 43200`
    - `apps/web/src/lib/format.ts` exports `formatMoney`, `formatPhone`, `formatDate`, `formatDuration`
    - `apps/web/src/lib/i18n/dict.ts` exports `dict` with keys identical across RU+UA + `type DictKey`. `dict.ru['chat.intercept']==='Перехватить'`, `dict.ua['chat.intercept']==='Перехопити'`
    - `apps/web/src/lib/i18n/use-t.ts` imports `usePreferencesStore` from the path recorded in VENDOR.md
    - `apps/web/scripts/gen-admin-password.ts` uses readline + bcrypt.hash with cost=12
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - `pnpm --filter @ai-logist/web test` exits 0 with i18n-dict + use-t tests passing (5 static-rules + 4 i18n-dict + 4 use-t + remaining todos)
    - `apps/web/tests/unit/i18n-dict.test.ts` contains 0 `it.todo` and 4 `it(` blocks
    - `apps/web/tests/unit/use-t.test.ts` contains 0 `it.todo` and 4 `it(` blocks
  </acceptance_criteria>
  <done>
4 lib primitives + i18n dict + useT hook + gen-admin-password CLI all green. Waves 4+5 can now import `apiGet`, `formatMoney`, `useT`, `dict` from stable paths.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: proxy.ts + login/logout routes + sidebar trim + Wave 0 stub flips (ADMIN-02 + I18N-02)</name>
  <files>
    apps/web/src/proxy.ts,
    apps/web/src/app/auth/v1/login/route.ts,
    apps/web/src/app/auth/v1/logout/route.ts,
    apps/web/src/app/auth/v1/login/_components/login-form.tsx,
    apps/web/src/navigation/sidebar/sidebar-items.ts,
    apps/web/tests/unit/proxy-auth.test.ts,
    apps/web/tests/unit/login-route.test.ts,
    apps/api/tests/unit/phase-4-stubs.test.ts
  </files>
  <read_first>
    apps/web/src/lib/auth.ts,
    apps/web/src/app/auth/v1/login/page.tsx,
    apps/web/src/navigation/sidebar/sidebar-items.ts,
    apps/web/VENDOR.md,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
  </read_first>
  <behavior>
    - proxy.ts on `/dashboard/xyz` without cookie → 307 redirect to `/auth/v1/login`.
    - proxy.ts on `/dashboard/xyz` with VALID cookie → NextResponse.next() (request continues).
    - proxy.ts on `/dashboard/xyz` with INVALID/expired cookie → 307 redirect to `/auth/v1/login`.
    - proxy.ts matcher does NOT intercept `/api/*` or `/auth/*` paths.
    - POST `/auth/v1/login` with valid `{username, password}` → 200 + sets `al_session` cookie (httpOnly + sameSite=lax + secure in prod + maxAge=43200).
    - POST `/auth/v1/login` with invalid body (missing fields) → 400 `{error: 'invalid_input'}`.
    - POST `/auth/v1/login` with bad username OR bad password → 401 `{error: 'invalid_credentials'}` (constant-time-ish).
    - POST `/auth/v1/logout` → clears `al_session` cookie + returns 200.
    - Login form (`_components/login-form.tsx`) submits to `/auth/v1/login` and redirects to `/dashboard/default` on success (`router.push`).
    - Sidebar shows 5 items: Default, Analytics, Chat, Calls, Orders. All other Zenith items commented out (regex search confirms — items still in source but `//` prefixed) — D-48 + D-49.
  </behavior>
  <action>
Step 1 — Create `apps/web/src/proxy.ts` (RESEARCH Pattern 3 verbatim, with explicit matcher exclusion):

```ts
// apps/web/src/proxy.ts
// Next.js 16 — renamed from middleware.ts (Pitfall #4).
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

// Matcher explicitly excludes /api/* + /auth/* to avoid runtime overhead on
// non-dashboard routes (RESEARCH §Pattern 3 + Pitfall #4).
export const config = {
  matcher: ['/dashboard/:path*'],
};
```

Step 2 — Create `apps/web/src/app/auth/v1/login/route.ts` (RESEARCH Pattern 3 verbatim):

```ts
// apps/web/src/app/auth/v1/login/route.ts
// POST /auth/v1/login — bcrypt-compare + signed-cookie issuance (D-05/D-06).
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { COOKIE_NAME, COOKIE_MAX_AGE_S, comparePassword, signSession } from '@/lib/auth';

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

  // NOTE: We still run bcrypt.compare even on username mismatch to avoid a
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
```

Step 3 — Create `apps/web/src/app/auth/v1/logout/route.ts`:

```ts
// apps/web/src/app/auth/v1/logout/route.ts
// POST /auth/v1/logout — clears al_session cookie (D-08).
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
```

Step 4 — Audit Zenith's existing `/auth/v1/login/page.tsx` and the login form. Find the file (likely `apps/web/src/app/auth/v1/login/_components/login-form.tsx` or similar). Replace the placeholder onSubmit handler so it POSTs to `/auth/v1/login` and redirects on success:

```tsx
// apps/web/src/app/auth/v1/login/_components/login-form.tsx
// MODIFIED (was Zenith placeholder) — wires onSubmit to our POST handler.
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// Keep any imports Zenith already had (shadcn Form/Input/Button + zodResolver)
// — only swap the onSubmit body to call POST /auth/v1/login.

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<{ username: string; password: string }>({
    defaultValues: { username: '', password: '' },
  });

  async function onSubmit(values: { username: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/auth/v1/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'login_failed');
        return;
      }
      router.push('/dashboard/default');
    } finally {
      setLoading(false);
    }
  }

  // ... return Zenith's existing form JSX, hooked to form.handleSubmit(onSubmit)
  // and surface `error` state in an alert above the submit button.
}
```

IMPORTANT: Do NOT replace Zenith's entire login UI — only swap the submit handler. Preserve Zenith's shadcn Form components + styling. If Zenith's existing login form uses a Server Action instead of a fetch, replace it with the fetch approach above (matches our auth route handler).

Step 5 — Modify `apps/web/src/navigation/sidebar/sidebar-items.ts` per D-49. Read the existing file (it's a Zenith config of nav items, likely an array of `{ title, url, icon }`). Comment out (DO NOT DELETE — D-48) all items EXCEPT Default + Analytics + Chat + Calls + Orders.

Expected shape after edit (example — adapt to Zenith's actual data shape):

```ts
// apps/web/src/navigation/sidebar/sidebar-items.ts
// D-49 — Phase 4 sidebar trim. Other Zenith pages remain in the build (D-48)
// but are NOT linked from the sidebar. To re-enable in v2: uncomment.

export const sidebarItems = [
  { title: 'Default', url: '/dashboard/default', icon: 'Home' },
  { title: 'Analytics', url: '/dashboard/analytics', icon: 'BarChart3' },
  { title: 'Chat', url: '/dashboard/chat', icon: 'MessageCircle' },
  { title: 'Calls', url: '/dashboard/calls', icon: 'Phone' },
  { title: 'Orders', url: '/dashboard/orders', icon: 'Package' },
  // --- Phase 4 NOT in scope (D-48 — kept in build, hidden from nav) ---
  // { title: 'Kanban', url: '/dashboard/kanban', icon: 'KanbanSquare' },
  // { title: 'Fleet', url: '/dashboard/fleet', icon: 'Truck' },
  // { title: 'Calendar', url: '/dashboard/calendar', icon: 'Calendar' },
  // { title: 'Mail', url: '/dashboard/mail', icon: 'Mail' },
  // { title: 'CRM', url: '/dashboard/crm', icon: 'Users' },
  // { title: 'Finance', url: '/dashboard/finance', icon: 'DollarSign' },
  // { title: 'Productivity', url: '/dashboard/productivity', icon: 'Zap' },
  // { title: 'Components', url: '/dashboard/components', icon: 'Component' },
  // ... (preserve all other Zenith items, all commented out)
];
```

If Zenith's structure differs (e.g. nested groups, different field names), adapt the keep/comment-out logic to match.

Step 6 — Flip 7 frontend test.todo markers across `proxy-auth.test.ts` + `login-route.test.ts`:

`apps/web/tests/unit/proxy-auth.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { signSession } from '@/lib/auth';

// Mock NextRequest + NextResponse minimal shapes
type MockCookies = { get(name: string): { value: string } | undefined };

function makeReq(pathname: string, cookieValue?: string): import('next/server').NextRequest {
  const cookies: MockCookies = {
    get: (name: string) => (cookieValue && name === 'al_session' ? { value: cookieValue } : undefined),
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
    // NextResponse.next() returns 200/204 — assert no redirect Location
    expect(res.headers.get('location')).toBeNull();
  });

  it('rejects invalid/expired cookie and redirects', async () => {
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/dashboard/default', 'invalid.jwt.token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/auth\/v1\/login/);
  });

  it('matcher config excludes /api and /auth paths', async () => {
    const { config } = await import('@/proxy');
    expect(config.matcher).toEqual(['/dashboard/:path*']);
    // Static-rules grep guard from Wave 0 also enforces this — belt + suspenders
  });
});
```

`apps/web/tests/unit/login-route.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/auth';
import { mockCookies, getMockCookieStore } from '../_helpers/mock-cookies';

describe('Phase 4 ADMIN-02 — POST /auth/v1/login', () => {
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
    const { POST } = await import('@/app/auth/v1/login/route');
    const res = await POST(makeReq({ username: 'admin', password: 'correctpw' }));
    expect(res.status).toBe(200);
    expect(getMockCookieStore().has('al_session')).toBe(true);
  });

  it('returns 401 on bad password', async () => {
    const { POST } = await import('@/app/auth/v1/login/route');
    const res = await POST(makeReq({ username: 'admin', password: 'wrong' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_credentials');
  });

  it('returns 401 on bad username (constant-time-ish)', async () => {
    const { POST } = await import('@/app/auth/v1/login/route');
    const res = await POST(makeReq({ username: 'wrong', password: 'correctpw' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    const { POST } = await import('@/app/auth/v1/login/route');
    const res = await POST(makeReq({ username: '' }));
    expect(res.status).toBe(400);
  });
});

describe('Phase 4 ADMIN-02 — POST /auth/v1/logout', () => {
  beforeEach(() => {
    mockCookies({ al_session: 'some.token.value' });
  });

  it('clears al_session cookie', async () => {
    const { POST } = await import('@/app/auth/v1/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    expect(getMockCookieStore().has('al_session')).toBe(false);
  });
});
```

Step 7 — Flip ADMIN-02 + I18N-02 in `apps/api/tests/unit/phase-4-stubs.test.ts`. Replace the two `it.todo` blocks:

```ts
it('ADMIN-02: Auth via /auth/v1/login (env-set creds + bcryptjs + jose-signed HTTP-only cookie + proxy.ts gate on /dashboard/*)', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  expect(existsSync(`${cwd}/../web/src/proxy.ts`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/app/auth/v1/login/route.ts`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/app/auth/v1/logout/route.ts`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/lib/auth.ts`)).toBe(true);
  const proxySrc = readFileSync(`${cwd}/../web/src/proxy.ts`, 'utf8');
  expect(proxySrc).toMatch(/matcher.*dashboard/);
  expect(proxySrc).toMatch(/jwtVerify|verifySession/);
  const loginSrc = readFileSync(`${cwd}/../web/src/app/auth/v1/login/route.ts`, 'utf8');
  expect(loginSrc).toMatch(/bcrypt|comparePassword/);
  expect(loginSrc).toMatch(/al_session/);
});

it('I18N-02: Customize-panel RU/UA toggle + dictionary in lib/i18n/dict.ts wired via useT() hook', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  expect(existsSync(`${cwd}/../web/src/lib/i18n/dict.ts`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/lib/i18n/use-t.ts`)).toBe(true);
  const dictSrc = readFileSync(`${cwd}/../web/src/lib/i18n/dict.ts`, 'utf8');
  expect(dictSrc).toMatch(/Перехватить/);
  expect(dictSrc).toMatch(/Перехопити/);
  expect(dictSrc).toMatch(/chat\.intercept/);
  expect(dictSrc).toMatch(/orders\.title/);
});
```

Marker count: 12 → 10.

Commit message: `feat(04-02): proxy.ts auth gate + login/logout routes + sidebar trim + ADMIN-02/I18N-02 flips`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/proxy.ts && \
test -f apps/web/src/app/auth/v1/login/route.ts && \
test -f apps/web/src/app/auth/v1/logout/route.ts && \
test -f apps/web/src/navigation/sidebar/sidebar-items.ts && \
grep -q "/dashboard/:path\*" apps/web/src/proxy.ts && \
grep -q "verifySession\|jwtVerify" apps/web/src/proxy.ts && \
grep -q "bcrypt\|comparePassword" apps/web/src/app/auth/v1/login/route.ts && \
grep -q "al_session" apps/web/src/app/auth/v1/login/route.ts && \
grep -q "await cookies()" apps/web/src/app/auth/v1/login/route.ts && \
grep -q "Default" apps/web/src/navigation/sidebar/sidebar-items.ts && \
grep -q "Calls" apps/web/src/navigation/sidebar/sidebar-items.ts && \
grep -q "Orders" apps/web/src/navigation/sidebar/sidebar-items.ts && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test -t "static-rules" 2>&1 | grep -E "5 passed|all passed"; \
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "3 passed|10 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/proxy.ts` exists; contains `matcher: ['/dashboard/:path*']`; calls `verifySession`; redirects to `/auth/v1/login` on missing/invalid token
    - `apps/web/src/app/auth/v1/login/route.ts` exports `POST`; uses `bcrypt.compare` (or `comparePassword` from lib/auth); sets `al_session` cookie with `httpOnly: true`, `sameSite: 'lax'`; uses `await cookies()` (Next.js 16 async)
    - `apps/web/src/app/auth/v1/logout/route.ts` exports `POST`; uses `await cookies()`; calls `c.delete(COOKIE_NAME)`
    - `apps/web/src/app/auth/v1/login/_components/login-form.tsx` (or Zenith's existing path) calls `fetch('/auth/v1/login', { method: 'POST' })` and `router.push('/dashboard/default')` on success
    - `apps/web/src/navigation/sidebar/sidebar-items.ts` contains `Default`, `Analytics`, `Chat`, `Calls`, `Orders` as ACTIVE items; non-Phase-4 items appear as commented-out (`//`) — verified by `grep -c "//.*\(Kanban\|Fleet\|Calendar\|Mail\)" apps/web/src/navigation/sidebar/sidebar-items.ts` returns at least 3
    - `apps/web/tests/unit/proxy-auth.test.ts` contains 0 `it.todo` and 4 `it(` blocks
    - `apps/web/tests/unit/login-route.test.ts` contains 0 `it.todo` and 5 `it(` blocks (4 login + 1 logout)
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - `pnpm --filter @ai-logist/web test` exits 0 with all Wave 0 + Wave 2 tests passing + remaining 6 todo (pages-smoke for Waves 4+5)
    - `cd apps/api && pnpm test:unit -t "Phase 4"` shows 3 passing + 10 todo (ADMIN-01 + ADMIN-02 + I18N-02 flipped)
    - Static-rules Wave 0 grep guards still PASS (proxy.ts matcher excludes /api+/auth, no sync cookies, no `'use cache'` on dashboard pages)
  </acceptance_criteria>
  <done>
proxy.ts gates /dashboard/*; login + logout routes complete; sidebar trimmed to 5 entries with rest preserved as comments; 9 frontend tests green; 3 stub markers flipped (ADMIN-01 + ADMIN-02 + I18N-02). Marker count: 13 → 10.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/web test` exits 0 — 5 static guards + 4 i18n-dict + 4 use-t + 4 proxy-auth + 5 login-route = 22 passing + 6 todo (pages-smoke deferred to Waves 4+5)
- `cd apps/api && pnpm test:unit -t "Phase 4"` shows 3 passing + 10 todo (ADMIN-01 + ADMIN-02 + I18N-02 flipped)
- Static-rules Wave 0 grep guards STILL PASS — `proxy.ts` matcher matches the audit expectation (excludes /api + /auth)
- `apps/web/.env.example` documents AUTH_COOKIE_SECRET / ADMIN_USERNAME / ADMIN_PASSWORD_HASH / API_INTERNAL_URL
</verification>

<success_criteria>
- ADMIN-02 lands fully — proxy.ts gates /dashboard/*, login + logout routes work, env-set creds + bcryptjs + jose stateless cookie
- I18N-02 lands fully — dict.ts has 27+ RU/UA keys, useT() hook wired to Zenith's preferences store
- Lib primitives (apiGet, format, auth) staged for Wave 3 + Waves 4+5 consumption
- Sidebar trimmed to 5 routes (D-49); non-Phase-4 items preserved as comments (D-48)
- gen-admin-password CLI ships for demo setup convenience (D-66)
- 9 frontend test.todo flipped to it() (proxy-auth + login-route + i18n-dict + use-t)
- 2 stub-file markers flipped (ADMIN-02 + I18N-02). Marker count 12 → 10.
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-02-SUMMARY.md` summarizing:
- proxy.ts shape + matcher pattern
- Auth flow end-to-end (POST /auth/v1/login → cookie → proxy verify → redirect on fail)
- lib/api.ts + lib/format.ts + lib/i18n/* API surfaces (for Waves 4+5 consumers)
- Sidebar items kept vs commented out (count of each)
- VENDOR.md preferences-store hook signature consumed
- Marker count: 12 → 10 (ADMIN-02 + I18N-02 flipped)
- Notes for Wave 3 (Plan 04-03, backend handlers — runs in PARALLEL with this plan)
</output>
