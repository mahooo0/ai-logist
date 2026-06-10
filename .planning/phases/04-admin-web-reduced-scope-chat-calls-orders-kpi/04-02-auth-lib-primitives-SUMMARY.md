---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 02
subsystem: admin-web/auth + admin-web/lib-primitives
tags: [admin, auth, i18n, proxy, sidebar, lib, jose, bcryptjs, next16]
one-liner: "Lands the Phase 4 cross-cutting layer: jose+bcryptjs auth (proxy.ts gate + /api/auth/{login,logout}), apiGet/format/i18n lib primitives, RU/UA dict + useT hook, sidebar trimmed to 5 routes — Waves 4+5 page rewires can now consume stable contracts."
requires:
  - 04-00-test-infra
  - 04-01-zenith-vendor
provides:
  - signSession / verifySession / comparePassword / hashPassword (lib/auth)
  - apiGet<Schema>(path, schema) server/client auto-routing fetcher (lib/api)
  - formatMoney / formatPhone / formatDate / formatDuration (lib/format)
  - dict + DictKey (lib/i18n/dict) + useT() hook (lib/i18n/use-t)
  - COOKIE_NAME='al_session' + COOKIE_MAX_AGE_S=43200 constants
  - /api/auth/login + /api/auth/logout Route Handlers (POST)
  - proxy.ts auth gate on /dashboard/:path*
  - sidebar trimmed to Default/Analytics/Chat/Calls/Orders
  - pnpm gen:admin-password CLI for ADMIN_PASSWORD_HASH
affects:
  - apps/web/src/app/(main)/auth/_components/login-form.tsx (rewired)
  - apps/api/tests/unit/phase-4-stubs.test.ts (markers 12 → 10)
tech-stack:
  added: []
  patterns:
    - "jose HS256 JWT (12h expiry) + bcryptjs cost-12 hash — stateless single-user auth (D-05/D-06)"
    - "Next.js 16 proxy.ts (renamed from middleware.ts per Pitfall #4)"
    - "Server/client auto-routing apiGet via typeof window === 'undefined' branch (D-17)"
    - "Zod boundary validation on every external fetch (D-14)"
    - "useT() reads from Zustand usePreferencesStore with falls-back-to-RU logic"
    - "Sidebar trim by commenting (NOT deleting) — preserves Zenith config for v2 (D-48/D-49)"
key-files:
  created:
    - apps/web/src/proxy.ts
    - apps/web/src/app/api/auth/login/route.ts
    - apps/web/src/app/api/auth/logout/route.ts
  modified:
    - apps/web/src/app/(main)/auth/_components/login-form.tsx
    - apps/web/src/navigation/sidebar/sidebar-items.ts
    - apps/web/tests/unit/proxy-auth.test.ts
    - apps/web/tests/unit/login-route.test.ts
    - apps/api/tests/unit/phase-4-stubs.test.ts
  created-by-task-1:
    - apps/web/src/lib/api.ts
    - apps/web/src/lib/auth.ts
    - apps/web/src/lib/format.ts
    - apps/web/src/lib/i18n/dict.ts
    - apps/web/src/lib/i18n/use-t.ts
    - apps/web/scripts/gen-admin-password.ts
    - apps/web/tests/unit/i18n-dict.test.ts (flipped 4 todos → it())
    - apps/web/tests/unit/use-t.test.ts (flipped 4 todos → it())
decisions:
  - "Routes live at /api/auth/login + /api/auth/logout (NOT /auth/v1/login/route.ts as plan said) — Zenith already serves a Server Component page at /auth/v1/login, and Next.js forbids a page.tsx + route.ts pair on the same URL segment. proxy.ts excludes /api/* so unauth requests reach the handler; redirect target stays /auth/v1/login (the page UI). Rule 3 deviation."
  - "Login form preserves Zenith's email-field UI but posts the value as `username` to match the ADMIN_USERNAME env contract — keeps single-user demo ergonomics while ADMIN-* schema stays clean."
  - "proxy.ts matcher restricted to /dashboard/:path* — /api/* + /auth/* explicitly excluded so auth routes + auth pages are reachable without bouncing the cookie gate (RESEARCH §Pattern 3 + static-rules guard #4)."
  - "Sidebar non-Phase-4 items COMMENTED-OUT not deleted (D-48) — Zenith pages remain in the build for future re-enable; 10 commented lines preserve the original config."
metrics:
  duration: "~12 minutes (Task 2 only — Task 1 was completed by prior agent at commit daa2aa8)"
  completed: 2026-06-10
  files_touched: 8
  tasks: 2
  unit_tests_added: 9 (4 proxy-auth + 5 login-route flipped from todo to it())
---

# Phase 04 Plan 02: Auth + Lib Primitives Summary

## One-liner

Lands the Phase 4 cross-cutting layer: jose+bcryptjs auth (proxy.ts gate + /api/auth/{login,logout}), apiGet/format/i18n lib primitives, RU/UA dict + useT hook, sidebar trimmed to 5 routes — Waves 4+5 page rewires can now consume stable contracts.

## What Shipped

### Task 1 (completed by prior agent at commit `daa2aa8`)

Six lib primitives + bcrypt CLI under `apps/web/src/lib/` + `scripts/`:

- **`lib/api.ts`** — `apiGet<T extends z.ZodTypeAny>(path, schema, init?)` server/client auto-routing fetcher. Uses `typeof window === 'undefined'` to decide between `${API_INTERNAL_URL}/api` (server-side Docker network) and `/api` (browser relative). `cache: 'no-store'`. Validates response via `schema.safeParse` and throws with first 3 issues on mismatch. (D-14/D-17)
- **`lib/auth.ts`** — `signSession({username})` → jose HS256 JWT (12h expiry). `verifySession(token)` → `{username}` or throws. `comparePassword(pw, hash)` + `hashPassword(pw)` (bcryptjs cost 12). `COOKIE_NAME='al_session'`, `COOKIE_MAX_AGE_S=43200`.
- **`lib/format.ts`** — `formatMoney(kopecksLike, lang)` (Intl currency 'RUB', maxFractionDigits=0). `formatPhone(e164, {mask?})` (libphonenumber-js; mask shows `+<cc> *** <last4>`). `formatDate(iso, lang)` (Intl.DateTimeFormat per D-54 — date-fns/locale is Phase 5 polish). `formatDuration(seconds)` (mm:ss for call durations).
- **`lib/i18n/dict.ts`** — Full RU + UA dictionaries with all 24 keys from RESEARCH Example 5 (`chat.*`, `calls.*`, `orders.*`, `kpi.*`, `order.*`). RU keys are identical sets to UA keys (test enforces).
- **`lib/i18n/use-t.ts`** — Client hook that reads `language` from `usePreferencesStore` (Zenith's Zustand store per VENDOR.md). Falls back to RU for `en`/`de`/`fr`/unset values. Supports `{var}` placeholder interpolation.
- **`scripts/gen-admin-password.ts`** — `pnpm --filter @ai-logist/web gen:admin-password` CLI that prompts for a password via readline and prints `ADMIN_PASSWORD_HASH=<bcrypt>` to stdout (cost 12). (D-66)

Plus 8 frontend test flips: `i18n-dict.test.ts` (4 it() blocks asserting RU/UA key parity, `Перехватить`/`Перехопити`, 24-key coverage) and `use-t.test.ts` (4 it() blocks mocking `usePreferencesStore` for RU default, UA, fallback, interpolation).

### Task 2 (this session — commit `e230384`)

- **`src/proxy.ts`** — Next.js 16 proxy (NOT `middleware.ts` per Pitfall #4). Reads `al_session` cookie via `req.cookies.get`, runs `verifySession`, calls `NextResponse.next()` on valid token, `NextResponse.redirect('/auth/v1/login')` on missing/invalid. Matcher restricted to `['/dashboard/:path*']` — `/api/*` + `/auth/*` are NOT intercepted (RESEARCH §Pattern 3 + static-rules guard #4).
- **`src/app/api/auth/login/route.ts`** — POST validates `{username, password}` via Zod, runs `comparePassword` against `ADMIN_PASSWORD_HASH` env (constant-time-ish: still runs bcrypt on username mismatch to avoid timing leak), signs jose JWT, sets HTTP-only + sameSite=lax + secure(prod) `al_session` cookie via `await cookies()` (Next.js 16 async API).
- **`src/app/api/auth/logout/route.ts`** — POST clears the cookie + returns `{ok:true}`.
- **`(main)/auth/_components/login-form.tsx`** — Zenith placeholder onSubmit (was sonner toast) rewired to `fetch('/api/auth/login', {method:'POST', ...})`. On success `router.push('/dashboard/default')`. Errors surface in an inline alert with localized friendly strings. Email-field UI stays (Zenith ergonomics) and posts the value as `username` to match the env contract.
- **`navigation/sidebar/sidebar-items.ts`** — Trimmed to 5 visible items: Default, Analytics, Chat, Calls, Orders (D-49). Non-Phase-4 items commented out NOT deleted (D-48) — 10 comment-prefixed lines preserve the Zenith config for a hypothetical v2 re-enable.
- **`tests/unit/proxy-auth.test.ts`** — 4 it() blocks flipped: unauth → 307 to login; valid token → no Location header; invalid jwt → 307; matcher config equals `['/dashboard/:path*']`.
- **`tests/unit/login-route.test.ts`** — 5 it() blocks flipped: valid creds set cookie + 200; bad password 401; bad username 401 (constant-time-ish); invalid body 400; logout clears cookie + 200.
- **`apps/api/tests/unit/phase-4-stubs.test.ts`** — Two `it.todo` flipped to real `it()`: ADMIN-02 asserts proxy.ts + /api/auth/{login,logout}/route.ts exist with matcher/jwtVerify/bcrypt/al_session greps; I18N-02 asserts dict.ts + use-t.ts exist with `Перехватить`/`Перехопити`/`chat.intercept`/`orders.title` greps. Marker count 12 → 10.

## Auth Flow End-to-End

```
[Browser] GET /dashboard/default
   ↓ proxy.ts (matcher: /dashboard/:path*)
   no al_session cookie → 307 Location: /auth/v1/login
   ↓
[Browser] GET /auth/v1/login (Zenith Server Component page)
   ↓ /auth/* NOT in proxy matcher → unmolested
   ↓ page.tsx renders <LoginForm /> client component
   ↓
[Browser] form submit → fetch POST /api/auth/login
   {username: 'admin', password: '...'}
   ↓ /api/* NOT in proxy matcher → unmolested
   ↓ Zod parses body
   ↓ comparePassword(pw, ADMIN_PASSWORD_HASH) — runs even on bad username
   ↓ signSession({username}) → HS256 JWT (12h)
   ↓ await cookies().set('al_session', token, {httpOnly, sameSite:'lax', secure:prod})
   ↓ 200 {ok:true}
   ↓
[Browser] router.push('/dashboard/default')
   ↓ proxy.ts
   verifySession(cookie) ok → NextResponse.next()
   ↓
[Browser] GET /dashboard/default — Zenith Server Component renders
```

Logout: POST /api/auth/logout → `await cookies().delete('al_session')` → 200. Next /dashboard/* hit redirects.

## Lib Primitive API Surfaces (for Waves 4+5 consumers)

### `import { apiGet } from '@/lib/api'`

```ts
// Server Component page.tsx
import { LeadSchema } from '@ai-logist/shared-types/api/leads';
const leads = await apiGet('/leads?stage=NEW', LeadSchema.array());
// Throws with first 3 Zod issues if response shape drifts.
```

### `import { useT } from '@/lib/i18n/use-t'`

```tsx
'use client';
const t = useT(); // reads usePreferencesStore.language; falls back to RU
<Button>{t('chat.intercept')}</Button>          // → 'Перехватить' (RU) / 'Перехопити' (UA)
<Button>{t('orders.col.price', {})}</Button>    // → 'Цена' / 'Ціна'
```

### `import { formatMoney, formatPhone, formatDate } from '@/lib/format'`

```ts
formatMoney(425000n, 'ru')                       // '4 250 ₽'
formatPhone('+79161234567', { mask: true })       // '+7 *** 4567'
formatDate('2026-06-10T12:34:00Z', 'ru')          // '10.06.2026, 12:34'
```

## Sidebar Items (count of each)

| State        | Count | Items |
|--------------|-------|-------|
| **Visible**  | 5     | Default, Analytics, Chat, Calls, Orders |
| **Commented out** | 22 (across 10 commented lines + nested auth subItems) | CRM, Finance, Productivity, Draggable, E-commerce, Academy, Logistics, Email, Calendar, Kanban, Invoice, Users, Roles, Authentication (+4 sub-items), Components, Others, Legacy group (Default V1, CRM V1, Finance V1, Analytics V1) |

The plan required `grep -c "//.*\(Kanban\|Fleet\|Calendar\|Mail\)"` to return at least 3 — actual count is **10** (covering all top-level + nested comment lines for Kanban/Calendar/Mail/CRM/Finance/etc). Well above threshold.

## VENDOR.md preferences-store hook signature consumed

Verbatim from `apps/web/VENDOR.md` (recorded by Plan 04-01 Task 1):

- **Hook:** `usePreferencesStore<T>(selector: (state: PreferencesState) => T): T`
- **Import path:** `'@/stores/preferences/preferences-provider'`
- **Field:** `language: 'en' | 'de' | 'fr'` (Zenith's `LANGUAGE_OPTIONS` shipped EN/DE/FR; Waves 4-5 may extend to add `ru`/`ua` if Customize panel UI is wired)

`use-t.ts` reads via `usePreferencesStore((s) => (s as { language?: string }).language ?? 'ru')` — tolerant cast lets the hook work today against Zenith's EN-only state and tomorrow against the extended RU/UA state.

## Marker Count

`apps/api/tests/unit/phase-4-stubs.test.ts`:

| Plan | Pre-count | Post-count | Flipped |
|------|-----------|-----------|---------|
| 04-00 (Wave 0) | — | 13 | (initial markers staged) |
| 04-01 (Wave 1) | 13 | 12 | ADMIN-01 |
| **04-02 (Wave 2)** | **12** | **10** | **ADMIN-02 + I18N-02** |
| 04-03 (Wave 3) | 10 | 5 | API-03/04/05/06/09 (planned) |
| 04-04 (Wave 4) | 5 | 3 | ADMIN-03 + ADMIN-NEW-08 (planned) |
| 04-05 (Wave 5) | 3 | 0 | ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 (planned) |

## Test Suite Status

| Suite | Pre-plan | Post-plan | Delta |
|-------|----------|-----------|-------|
| `apps/web` | 13 passed / 6 todo (Task 1 net) | **22 passed / 6 todo** | +9 passing (4 proxy + 5 login) |
| `apps/api` unit | 188 / 12 todo | **190 / 10 todo** | +2 flipped (ADMIN-02 + I18N-02) |
| Typecheck (`apps/web`) | clean | clean | — |
| Biome (changed files) | n/a | clean | — |
| Static-rules grep guards | 5/5 GREEN | 5/5 GREEN | proxy.ts now passes matcher gate (was vacuously empty pre-Wave 2) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Auth route path collision with Zenith page**
- **Found during:** Task 2 (the test scaffold flipped by Task 1 had already documented this — `tests/unit/login-route.test.ts:5-11` notes the deviation)
- **Issue:** The plan specified handlers at `apps/web/src/app/auth/v1/login/route.ts` and `apps/web/src/app/auth/v1/logout/route.ts`, but Zenith ships `(main)/auth/v1/login/page.tsx` serving the SAME URL `/auth/v1/login`. Next.js App Router forbids a `page.tsx` + `route.ts` pair at the same URL segment — build would fail with a routing conflict error.
- **Fix:** Routes moved to `/api/auth/login` + `/api/auth/logout` (under `apps/web/src/app/api/auth/`). proxy.ts matcher already excludes `/api/*` so unauthenticated requests still reach them. proxy.ts redirect target stays `/auth/v1/login` (the page UI). Login form posts to `/api/auth/login`.
- **Files modified:** `src/app/api/auth/login/route.ts` (created), `src/app/api/auth/logout/route.ts` (created), `(main)/auth/_components/login-form.tsx` (fetch URL), `tests/unit/login-route.test.ts` (import paths), `apps/api/tests/unit/phase-4-stubs.test.ts` (ADMIN-02 path assertions)
- **Commit:** `e230384`

**2. [Rule 1 — Bug] Login form was using Zenith's `email` field, but API contract is `{username, password}`**
- **Found during:** Task 2 — rewriting login-form.tsx
- **Issue:** Zenith's placeholder form uses `email: z.string().email(...)` with strict email validation. Demo admin login is a single-user environment-set credential (`ADMIN_USERNAME='admin'`) — requiring an email format would block the demo.
- **Fix:** Kept the email field's UI (Zenith ergonomics: label + autoComplete + zenith shadcn styling) but relaxed validation to `z.string().min(1)` and renamed label to "Username". Submit handler posts `{username: values.email, password: ...}` so the env contract stays clean.
- **Files modified:** `(main)/auth/_components/login-form.tsx`
- **Commit:** `e230384`

**3. [Rule 1 — Formatting] Biome single-quote vs double-quote normalization**
- **Found during:** Post-implementation biome check
- **Issue:** New files used double-quotes (matching Zenith's existing convention), but the project's root `biome.json` enforces single-quotes for the apps/web package.
- **Fix:** Ran `pnpm exec biome check --write` on touched files — fixed 2 files (login-form.tsx + sidebar-items.ts).
- **Files modified:** Same as above (formatting-only changes).

### Authentication Gates

None — Task 1 was completed in a prior agent session at commit `daa2aa8`; this session resumed and finished Task 2. No external auth gates encountered.

## Notes for Wave 3 (Plan 04-03, runs in PARALLEL with this plan)

Wave 3 ships backend handlers under `apps/api/src/routes/`:
- GET `/api/leads?stage=&channel=` (API-03)
- GET `/api/orders` joined + `/api/orders/:id` detail (API-04)
- GET `/api/trucks` (API-05)
- GET `/api/clients/:id/messages` UNION (API-06)
- GET `/api/analytics/kpi` extended shape (API-09)
- GET `/api/calls` (new endpoint for Wave 4 ADMIN-NEW-08)

Wave 3 does NOT consume Wave 2 outputs — it's a parallel backend track that ships the contracts Waves 4+5 will fetch via `apiGet`. Wave 2's lib primitives (`apiGet`, `useT`, `formatMoney`) are the CONSUMER side; Wave 3 ships the PRODUCER side. After both land, Waves 4 + 5 connect them in page Server Components + client containers.

## Self-Check: PASSED

Verifications performed:

- `[ -f apps/web/src/proxy.ts ]` → FOUND
- `[ -f apps/web/src/app/api/auth/login/route.ts ]` → FOUND
- `[ -f apps/web/src/app/api/auth/logout/route.ts ]` → FOUND
- `[ -f apps/web/src/lib/api.ts ]` (Task 1) → FOUND
- `[ -f apps/web/src/lib/auth.ts ]` (Task 1) → FOUND
- `[ -f apps/web/src/lib/format.ts ]` (Task 1) → FOUND
- `[ -f apps/web/src/lib/i18n/dict.ts ]` (Task 1) → FOUND
- `[ -f apps/web/src/lib/i18n/use-t.ts ]` (Task 1) → FOUND
- `[ -f apps/web/scripts/gen-admin-password.ts ]` (Task 1) → FOUND
- `git log --oneline | grep daa2aa8` → FOUND (Task 1 commit)
- `git log --oneline | grep e230384` → FOUND (Task 2 commit)
- `grep -q "matcher.*dashboard" apps/web/src/proxy.ts` → FOUND
- `grep -q "verifySession" apps/web/src/proxy.ts` → FOUND
- `grep -q "comparePassword" apps/web/src/app/api/auth/login/route.ts` → FOUND
- `grep -q "await cookies()" apps/web/src/app/api/auth/login/route.ts` → FOUND
- `grep -c "it.todo" apps/api/tests/unit/phase-4-stubs.test.ts` → 10 (was 12)
- `grep -c "it.todo" apps/web/tests/unit/proxy-auth.test.ts` → 0
- `grep -c "it.todo" apps/web/tests/unit/login-route.test.ts` → 0
- `grep -c "it.todo" apps/web/tests/unit/i18n-dict.test.ts` → 0 (Task 1)
- `grep -c "it.todo" apps/web/tests/unit/use-t.test.ts` → 0 (Task 1)
- `cd apps/web && pnpm test` → 22 passed | 6 todo
- `cd apps/web && pnpm exec tsc --noEmit` → exit 0
- `cd apps/api && pnpm test:unit` → 190 passed | 10 todo
- `pnpm exec biome check apps/web/src/proxy.ts apps/web/src/app/api/auth …` → clean
