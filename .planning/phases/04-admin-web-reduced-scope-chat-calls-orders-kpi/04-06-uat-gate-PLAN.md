---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 06
type: execute
wave: 4
depends_on: [04-04, 04-05]
files_modified:
  - README.md
  - apps/web/README.md
  - .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md
  - apps/api/tests/unit/phase-4-stubs.test.ts
  - apps/web/tests/unit/static-rules.test.ts
  - .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md
  - .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Top-level README.md gains '## Admin Dashboard Dev Setup' section between Telegram + Voice setup and 'Project layout'; 7 numbered steps from clone-monorepo through `pnpm --filter @ai-logist/web dev` opening :3001/auth/v1/login + 6 dashboard pages reachable."
    - "apps/web/README.md (new) documents: env vars (ADMIN_USERNAME / ADMIN_PASSWORD_HASH / AUTH_COOKIE_SECRET / API_INTERNAL_URL), `pnpm gen:admin-password` usage, npm scripts (dev / build / typecheck / test), Pitfall #13 escape rules ('use cache' ban + border-border explicit + page.tsx server / _components client)."
    - "HUMAN-UAT-05.md (new) provides 8-step protocol: (1) docker compose up clean stack; (2) seed runs; (3) Telegram smoke test (UAT-03); (4) Voice smoke test (UAT-04); (5) login at :3001/auth/v1/login; (6) navigate 6 pages — /default, /analytics, /chat, /calls, /orders, /orders/[id]; (7) trigger manager intercept end-to-end via Telegram bot; (8) Customize-panel RU↔UA toggle; pre-flight checklist; rollback steps."
    - "VALIDATION.md `nyquist_compliant` frontmatter flag is flipped to `true` and `wave_0_complete` is `true` (all Wave 0 reqs landed in Plan 04-00 + filled in subsequent plans)."
    - "Phase 4 marker count is verified 0 (no `test.todo` in phase-4-stubs.test.ts); CI guard `! grep -q 'test\\.todo' apps/api/tests/unit/phase-4-stubs.test.ts` passes."
    - "Final cross-check: `pnpm -r test` exits 0; `pnpm --filter @ai-logist/web build` exits 0; `pnpm exec biome check` exits 0; `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0; `pnpm --filter @ai-logist/api exec tsc --noEmit` exits 0."
    - "Phase summary at .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md documents what shipped + what deferred to v2 + UAT-05 outcome placeholder + token/time totals + all 13 reqs marked Complete in REQUIREMENTS.md (commit message also flips REQUIREMENTS traceability table)."
    - "STATE.md gains 'Phase 4' Key Decisions entry summarizing the locked architecture (Zenith vendored / proxy.ts / SWR polling / no WS / cookie auth / recharts client boundary)."
    - "All 5 Wave 0 static-rules grep guards remain GREEN against the final tree (no `'use cache'` on dynamic pages, no bare `border`, no sync `cookies()`, no `'use client'` on page.tsx, proxy.ts matcher correct)."
    - "checkpoint:human-verify marker rendered in plan output so /gsd:execute-phase halts before commit and presents UAT-05 instructions to user."
  artifacts:
    - path: "README.md"
      provides: "Top-level repo README with admin dashboard setup section"
      contains: "Admin Dashboard,pnpm dev,3001,/auth/v1/login,Pitfall"
    - path: "apps/web/README.md"
      provides: "Web-app local docs: env, scripts, conventions"
      contains: "ADMIN_USERNAME,ADMIN_PASSWORD_HASH,AUTH_COOKIE_SECRET,API_INTERNAL_URL,Pitfall #13"
    - path: ".planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md"
      provides: "8-step human-verifiable protocol for Phase 4"
      contains: "docker compose up,localhost:3001,/auth/v1/login,/dashboard/default,/dashboard/chat,/dashboard/calls,/dashboard/orders,RU,UA"
    - path: ".planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md"
      provides: "Phase 4 wrap-up — what shipped vs deferred"
      contains: "Phase 4,Complete,REQUIREMENTS,ADMIN-01,ADMIN-NEW-08,I18N-02"
  key_links:
    - from: "README.md ## Admin Dashboard Dev Setup"
      to: "apps/web/README.md detail + HUMAN-UAT-05.md protocol"
      via: "cross-link references"
      pattern: "apps/web/README.md,HUMAN-UAT-05.md"
    - from: "HUMAN-UAT-05.md step 7"
      to: "Phase 3 manager intercept endpoints"
      via: "End-to-end demo path"
      pattern: "intercept,manager-message,release"
---

<objective>
Close Phase 4 with everything needed for a clean UAT pass: cross-reference documentation, human-verifiable test protocol, validation contract sign-off, phase summary, and a `checkpoint:human-verify` gate that halts execution until the human owner confirms UAT-05.

Purpose:
- Update top-level `README.md` with `## Admin Dashboard Dev Setup` (Pattern mirror of Phase 3's Telegram section and Phase 3.1's Voice section).
- Create `apps/web/README.md` documenting env vars, scripts, Pitfall #13 escape rules.
- Create `HUMAN-UAT-05.md` — 8-step protocol that exercises Phase 1+2+3+3.1+4 end-to-end (the demo storyboard).
- Flip `VALIDATION.md` frontmatter — `nyquist_compliant: true` + `wave_0_complete: true` (all observable assertions wired).
- Verify Phase 4 marker count is 0 with CI guard.
- Generate `04-PHASE-SUMMARY.md` (mirroring Phase 3.1's PHASE-SUMMARY.md pattern).
- Render `checkpoint:human-verify` marker so executor halts before commit and presents UAT-05 to user.
- Update STATE.md with Phase 4 Key Decisions entry.
- Update REQUIREMENTS.md traceability table — flip 13 reqs from Pending to Complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03.1-voice-channel-elevenlabs-twilio/03.1-PHASE-SUMMARY.md
@README.md
@apps/web/VENDOR.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md

<interfaces>
<!-- Style mirror: HUMAN-UAT-03.md from Phase 3 + HUMAN-UAT-04.md from Phase 3.1 — same 8-10 step protocol shape -->
<!-- Style mirror: 03.1-PHASE-SUMMARY.md — token totals, what shipped, what deferred, UAT outcome placeholder -->
<!-- 13 reqs to flip in REQUIREMENTS.md: API-03, API-04, API-05, API-06, API-09, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-05, ADMIN-NEW-02, ADMIN-NEW-03, ADMIN-NEW-08, I18N-02 -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: README updates + apps/web/README.md + HUMAN-UAT-05.md</name>
  <files>
    README.md,
    apps/web/README.md,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md
  </files>
  <read_first>
    README.md,
    apps/web/VENDOR.md,
    .planning/phases/03-telegram-channel/03-CONTEXT.md,
    .planning/phases/03.1-voice-channel-elevenlabs-twilio/HUMAN-UAT.md
  </read_first>
  <behavior>
    - Find the "Voice Channel Dev Setup" section in README.md (added by Plan 03.1-03). Insert "Admin Dashboard Dev Setup" section AFTER it and BEFORE "Project layout" (or equivalent).
    - The README section follows the 7-step pattern of Telegram + Voice setup sections — short, scannable, links to `apps/web/README.md` for details.
    - `apps/web/README.md` (new file) is the canonical web-app local doc.
    - `HUMAN-UAT-05.md` is the end-to-end demo protocol — 8 steps, each with a runnable command + expected observation + rollback note.
  </behavior>
  <action>
Step 1 — Read README.md and identify the line/section break to insert after the Voice setup section. Use grep:
```bash
grep -n "Voice Channel Dev Setup\|## Project layout\|^## " README.md
```

Step 2 — Insert this section into README.md (between Voice setup and Project layout):

```markdown
## Admin Dashboard Dev Setup

The web admin (Next.js 16 + Zenith template) runs on port 3001 behind Caddy at `/`. It reads from the Fastify API at `/api/*`.

1. **Install deps** — already done if you ran `pnpm install` at repo root.
2. **Generate an admin password hash:**
   ```bash
   pnpm --filter @ai-logist/web gen:admin-password
   # Copy output ADMIN_PASSWORD_HASH into apps/web/.env.local
   ```
3. **Generate an auth cookie secret:**
   ```bash
   openssl rand -hex 32
   # Copy into AUTH_COOKIE_SECRET in apps/web/.env.local
   ```
4. **Set env vars** (in `apps/web/.env.local`):
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=<output from step 2>
   AUTH_COOKIE_SECRET=<output from step 3>
   API_INTERNAL_URL=http://api:3000   # or http://localhost:3000 outside docker
   ```
5. **Start dev server:**
   ```bash
   pnpm --filter @ai-logist/web dev
   # http://localhost:3001 → redirects to /auth/v1/login
   ```
6. **Log in** with `admin` + your password → lands on `/dashboard/default`.
7. **Reachable pages:** `/dashboard/default`, `/dashboard/analytics`, `/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]`. NOT in v1: `/dashboard/kanban`, `/dashboard/fleet`, `/dashboard/calendar`, `/dashboard/tracking` (deferred to v2 per 2026-06-09 pivot).

**Details:** see `apps/web/README.md`.

### Pre-flight checklist

- [ ] `pnpm --filter @ai-logist/web build` exits 0
- [ ] `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- [ ] `pnpm exec biome check` exits 0
- [ ] Login form rejects bad password (401)
- [ ] Customize-panel language toggle flips RU↔UA on chat header

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Redirect loop on /dashboard/* | `AUTH_COOKIE_SECRET` empty or rotated | Re-generate + relogin |
| `/api/*` returns 502 | API container not up | `docker compose ps`, `docker compose logs api` |
| Recharts crashes on /analytics | Stale `analytics-app.tsx` cache | `rm -rf apps/web/.next` and retry |
| Russian shows as ?????? | Missing dictionary key | grep `lib/i18n/dict.ts` for missing entry |
| Border colors look wrong | Tailwind v4 default change (Pitfall #13) | Replace bare `border` with `border-border` |

```

Step 3 — Create `apps/web/README.md`:

```markdown
# @ai-logist/web — Admin Dashboard

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + shadcn/ui admin dashboard, vendored from `mahooo0/next-shadcn-admin-dashboard` (Zenith Admin, MIT).

## Pages (v1 — reduced scope per 2026-06-09 pivot)

| Page | Purpose | Requirement |
|------|---------|-------------|
| `/auth/v1/login` | Single-user login | ADMIN-02 |
| `/dashboard/default` | Compact KPI tiles + last-5 calls + last-5 orders | ADMIN-05 |
| `/dashboard/analytics` | 5 recharts (funnel, channel split, revenue, calls per day, avg duration) | ADMIN-05 |
| `/dashboard/chat` | Multi-channel chat (Telegram + Voice transcript turns) | ADMIN-03 |
| `/dashboard/calls` | Calls table + filters + detail modal with audio + transcript | ADMIN-NEW-08 |
| `/dashboard/orders` | Orders table with channel + status filters | ADMIN-NEW-02 |
| `/dashboard/orders/[id]` | Read-only order detail + event timeline + channel breadcrumb | ADMIN-NEW-03 |

**Deferred to v2:** kanban, fleet, calendar, tracking, search, PDF, price-override.

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `ADMIN_USERNAME` | yes | Single-user login identity (default `admin`) |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash; generate via `pnpm gen:admin-password` |
| `AUTH_COOKIE_SECRET` | yes | 32-byte HS256 key for `al_session` cookie |
| `API_INTERNAL_URL` | no | Server-side fetch base; default `http://api:3000` in docker, `http://localhost:3000` outside |

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js dev on :3001 (Turbopack) |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` strict |
| `pnpm test` | vitest + happy-dom (frontend unit tests) |
| `pnpm gen:admin-password` | bcrypt hash CLI for `.env.local` |

## Conventions (per spec §7.3 + Pitfall #13)

1. **`page.tsx` is a Server Component** — fetches data via `apiGet`, passes to client boundary.
2. **`_components/<feature>-app.tsx` is the SOLE `'use client'` boundary** for that feature.
3. **NEVER `'use cache'`** on dynamic pages (`/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]`).
4. **`'use cache'` IS allowed** on `/dashboard/default` + `/dashboard/analytics` (KPI aggregated — D-13).
5. **Always `border-border` explicit** — Tailwind v4 changed bare `border` default from `gray-200` to `currentColor`.
6. **Next.js 16 async APIs** — `cookies()`, `headers()`, `params`, `searchParams` are all async; always `await`.
7. **`proxy.ts` not `middleware.ts`** — Next.js 16 native name.
8. **All UI strings via `useT()`** — RU default, UA via Customize panel.

## Architecture

```
apps/web/src/
├── app/
│   ├── (main)/dashboard/
│   │   ├── default/page.tsx + _components/
│   │   ├── analytics/page.tsx + _components/
│   │   ├── chat/page.tsx + _components/
│   │   ├── calls/page.tsx + _components/
│   │   └── orders/page.tsx + [id]/page.tsx + _components/
│   └── auth/v1/login/route.ts + page.tsx
├── proxy.ts                   ← Next.js 16 auth gate (per RESEARCH Pattern 4)
├── lib/
│   ├── api.ts                 ← apiGet<Schema>(path, schema) with auto-routing
│   ├── auth.ts                ← jose JWT signing/verification + bcrypt
│   ├── format.ts              ← formatMoney + formatPhone + formatDate
│   └── i18n/
│       ├── dict.ts            ← RU/UA dictionary
│       └── use-t.ts           ← useT() hook reading Zenith preferences store
└── navigation/sidebar/sidebar-items.ts ← trimmed to 5 nav items (D-49)
```

## Origin (vendored from Zenith)

See `VENDOR.md` for exact git SHA + npm versions captured at vendor time.

## Phase 4 reference

- CONTEXT (locked design): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md`
- RESEARCH (technical brief): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md`
- VALIDATION (test contract): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md`
- UAT protocol: `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md`
```

Step 4 — Create `HUMAN-UAT-05.md`:

```markdown
# Phase 4 — Human Acceptance Test (UAT-05)

> Target: confirm the admin dashboard shows what the voice + Telegram channels produced, end-to-end, on a clean machine.
> Duration: ~15 minutes
> Prerequisites: completed UAT-03 (Telegram) and UAT-04 (Voice) at least once

## Pre-flight

```bash
docker compose down -v        # nuke any prior state
docker compose up -d --build  # rebuild + start fresh
sleep 5
curl -sS http://localhost:8080/api/health | jq .   # must show PostGIS_Version + telegram=ok + voice=ok
pnpm --filter @ai-logist/api db:seed               # idempotent seed
```

Expected: `{ "ok": true, "checks": { "db": "ok", "postgis": "PostGIS_Version()...", "telegram": "ok", "voice": "ok" } }`.

## Step 1 — Login

1. Open `http://localhost:8080/` in browser
2. Expected: 302 redirect to `/auth/v1/login`
3. Enter `admin` + password (from your `.env.local` ADMIN_PASSWORD_HASH source)
4. Expected: lands on `/dashboard/default` with KPI tiles + last-5 lists

✅ **Pass criterion:** No console errors; KPI tiles render with real numbers from /api/analytics/kpi.

## Step 2 — Navigate 6 pages

Click through:
1. `/dashboard/default` — KPI tiles + last-5 calls + last-5 orders
2. `/dashboard/analytics` — 5 recharts (funnel, channel split, revenue, calls per day, avg duration); window selector (day/week/month) updates `?window=` and re-renders charts
3. `/dashboard/chat` — empty thread list initially (no clients yet)
4. `/dashboard/calls` — empty table + filter bar
5. `/dashboard/orders` — empty table + filter bar
6. (no `/orders/[id]` yet — depends on real order)

✅ **Pass criterion:** All 6 pages render without errors. Sidebar shows only these 5 nav items (no Kanban/Fleet/Calendar/Tracking — D-49). Customize panel reachable.

## Step 3 — Telegram lead end-to-end (replay UAT-03)

Send the canonical RU script to the bot:
```
Привет
Киев-Львов, 18 тонн, тент
Подтверждаю
```

Watch in admin:
- `/dashboard/chat` left rail gets a new thread
- Click it → right pane shows TG-badged messages chronologically
- `/dashboard/calls` stays empty (this is Telegram, not voice)
- `/dashboard/orders` gains 1 row (status CREATED → maybe DRIVER_ASSIGNED if driver_telegram_id is seeded)

✅ **Pass criterion:** chat thread + order row both visible; SWR polling updates within 15s.

## Step 4 — Voice lead end-to-end (replay UAT-04 — gated, costs ~$1)

Make 1 real Twilio call. After hang-up:
- `/dashboard/calls` gains 1 row with outcome='completed', lang='ru'
- Click row → modal opens with audio + transcript
- Press play → audio streams from Twilio recording URL
- Click any transcript turn → audio seeks to that timestamp
- `/dashboard/chat` thread for this client (by phone) shows Voice-badged transcript turns interleaved chronologically with TG (if any)

✅ **Pass criterion:** Modal opens <500ms; audio plays; turn-click seek works; chat unifies channels.

## Step 5 — Order detail breadcrumb

From `/dashboard/orders`, click the order row from step 3 (Telegram) → `/dashboard/orders/[id]`:
- Header: order number + status + price
- Channel breadcrumb: "Открыть диалог" → routes back to chat
- Left column: client/route/truck/cargo cards
- Right column: vertical event timeline with type + actor + timestamp

Then click the order from step 4 (Voice):
- Channel breadcrumb: "Прослушать звонок" → routes to /dashboard/calls?openCall=<callId>

✅ **Pass criterion:** Breadcrumb logic correct per D-38; timeline shows order_events.

## Step 6 — Manager intercept

In `/dashboard/chat` with a Telegram thread active and lead.manager_active=false:
1. Click `Перехватить` button → header changes; input box becomes "Сообщение от менеджера"
2. Type a message → send → confirm Telegram client receives it (bot relays via POST /manager-message)
3. Click `Вернуть боту` → manager_active=false again; bot replies "Передаю обратно AI-ассистенту"

✅ **Pass criterion:** Intercept flow works end-to-end through Phase 3 endpoints. Voice threads NEVER show intercept buttons (D-47).

## Step 7 — RU/UA toggle

Open Customize panel (top-right) → switch language to UA:
- Chat header label flips to "Перехопити"
- Calls filter labels translate
- Orders columns translate
- Refresh page → preference persists (Zustand+localStorage)

Switch back to RU.

✅ **Pass criterion:** I18N-02 round-trip works; no missing keys visible as `chat.intercept` raw.

## Step 8 — Pitfall #13 grep guards

```bash
pnpm --filter @ai-logist/web test -t "static-rules"
```

Expected: 5 grep guards GREEN (no `'use cache'` on dynamic pages, no bare `border`, no sync `cookies()`, no `'use client'` on page.tsx, proxy.ts matcher correct).

```bash
pnpm --filter @ai-logist/api test:unit -t "Phase 4"
```

Expected: 13 passed + 0 todo.

✅ **Pass criterion:** All test commands green.

---

## Sign-off

- [ ] Step 1 — Login passes
- [ ] Step 2 — All 6 pages reachable
- [ ] Step 3 — Telegram lead end-to-end (admin reflects it)
- [ ] Step 4 — Voice call end-to-end (with audio + transcript + seek)
- [ ] Step 5 — Order detail breadcrumb routes correctly
- [ ] Step 6 — Manager intercept round-trip
- [ ] Step 7 — RU/UA toggle works
- [ ] Step 8 — Pitfall #13 + Phase 4 stubs all green

**Reviewer:** _______
**Date:** _______
**Outcome:** PASS / FAIL (note any deviations below)

## Rollback (if UAT-05 fails)

If a step fails, capture:
1. Browser console errors (Cmd+Opt+J)
2. Network tab for failed `/api/*` requests
3. `docker compose logs --tail 100 api web` output
4. Phase 4 stub counts: `grep -c "test\.todo" apps/api/tests/unit/phase-4-stubs.test.ts`

Open a GSD bug session: `/gsd:debug "Phase 4 UAT-05 failure: <step>"`.
```

Commit message: `docs(04-06): README admin section + apps/web/README + HUMAN-UAT-05`.
  </action>
  <verify>
    <automated>
test -f README.md && grep -q "Admin Dashboard Dev Setup" README.md && \
test -f apps/web/README.md && grep -q "@ai-logist/web" apps/web/README.md && grep -q "Pitfall #13" apps/web/README.md && \
test -f .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md && \
grep -q "Step 1 — Login" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md && \
grep -q "Step 4 — Voice" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md && \
grep -q "Step 6 — Manager intercept" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md
    </automated>
  </verify>
  <acceptance_criteria>
    - `README.md` contains literal heading `## Admin Dashboard Dev Setup` with 7 numbered steps + pre-flight checklist + troubleshooting table
    - `apps/web/README.md` exists with: pages table (6 rows + deferred-to-v2 row), environment table (ADMIN_USERNAME/PASSWORD_HASH/COOKIE_SECRET/API_INTERNAL_URL), scripts table, Pitfall #13 conventions (8 items), architecture diagram, vendor reference
    - `HUMAN-UAT-05.md` exists with 8 steps (Login / Navigate 6 pages / Telegram lead / Voice lead / Order detail / Manager intercept / RU-UA toggle / Pitfall #13 grep guards), pre-flight + sign-off + rollback sections
    - All three files reference each other (README.md → apps/web/README.md → HUMAN-UAT-05.md cross-links)
  </acceptance_criteria>
  <done>
Documentation triangle complete: top-level README onboards a fresh dev in <5min; apps/web/README is the canonical web-app spec; HUMAN-UAT-05 is the 15min end-to-end test protocol.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: VALIDATION sign-off + 0-todo verification + STATE + REQUIREMENTS flips + PHASE-SUMMARY + checkpoint:human-verify</name>
  <files>
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md,
    apps/api/tests/unit/phase-4-stubs.test.ts,
    apps/web/tests/unit/static-rules.test.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md,
    .planning/STATE.md,
    .planning/REQUIREMENTS.md
  </files>
  <read_first>
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md,
    apps/api/tests/unit/phase-4-stubs.test.ts,
    .planning/phases/03.1-voice-channel-elevenlabs-twilio/03.1-PHASE-SUMMARY.md,
    .planning/STATE.md,
    .planning/REQUIREMENTS.md
  </read_first>
  <behavior>
    - Verify `phase-4-stubs.test.ts` has 0 `test.todo` markers (Plan 04-05 should have flipped the last 3).
    - Verify all 5 static-rules grep guards still pass.
    - Flip VALIDATION.md frontmatter: `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`, `Approval: approved 2026-06-10`.
    - In REQUIREMENTS.md traceability table, flip 13 reqs from "Pending" → "Complete": API-03/04/05/06/09, ADMIN-01/02/03/05, ADMIN-NEW-02/03/08, I18N-02.
    - In REQUIREMENTS.md "Active" → "Validated", move ADMIN block (the v1-reduced part) with Phase 4 reference (mirrors how Phase 3/3.1 promoted their reqs).
    - In STATE.md "Accumulated Context > Key Decisions", prepend a Phase 4 entry summarizing locked architecture.
    - Create `04-PHASE-SUMMARY.md` mirroring `03.1-PHASE-SUMMARY.md` shape (scope, what shipped, what deferred, tests, files, commits, UAT outcome placeholder).
    - End the second task with a `checkpoint:human-verify` marker so /gsd:execute-phase halts and presents HUMAN-UAT-05 to the user.
  </behavior>
  <action>
Step 1 — Verify Phase 4 marker count is 0:
```bash
TODO_COUNT=$(grep -c "test\.todo" apps/api/tests/unit/phase-4-stubs.test.ts)
test "$TODO_COUNT" -eq 0 || { echo "FAIL: $TODO_COUNT test.todo markers remain"; exit 1; }
```

Step 2 — Run all Wave 0 static-rules guards:
```bash
cd apps/web && pnpm test -t "static-rules" 2>&1 | tee /tmp/static-rules.log
grep -q "5 passed\|all passed" /tmp/static-rules.log || { echo "FAIL: static-rules guards regressed"; exit 1; }
```

Step 3 — Edit `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md` frontmatter:

Replace
```yaml
status: draft
nyquist_compliant: false
wave_0_complete: false
```
with
```yaml
status: complete
nyquist_compliant: true
wave_0_complete: true
approved: 2026-06-10
```

Also flip the trailing **Approval:** line from `pending` to `approved 2026-06-10`.

Step 4 — Flip 13 reqs in `.planning/REQUIREMENTS.md` traceability table:

For each of the 13 rows (API-03, API-04, API-05, API-06, API-09, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-05, ADMIN-NEW-02, ADMIN-NEW-03, ADMIN-NEW-08, I18N-02) — change the `Status` column from `Pending` to `Complete`.

In the "Active" section, move the entire ADMIN block (v1-reduced — `ADMIN-01` through `ADMIN-NEW-08`, plus `I18N-02`) under "Validated" with a `Phase 4 — Admin Web (REDUCED scope, 2026-06-10):` header listing the 13 reqs that landed. Use the same shape as the existing Phase 3 + Phase 3.1 "Validated" entries.

Step 5 — Update `.planning/STATE.md` "Accumulated Context > Key Decisions" — prepend (or insert at top of decisions list, before Plan 03.1-03):

```markdown
- **Phase 4 (Admin Web REDUCED):** Zenith template (mahooo0/next-shadcn-admin-dashboard) vendored straight into `apps/web/` with directory layout preserved per spec §7.3 (page.tsx server / _components/<feature>-app.tsx client). Single-admin auth via `proxy.ts` (Next.js 16 native — not deprecated `middleware.ts`) + bcryptjs + jose HS256 12h cookie `al_session`. Data fetching: Server Component initial fetch via `apiGet<Schema>` + Client SWR with locked polling intervals (5s chat-active, 15s chat-list/orders, 30s calls, 10s order-detail, 60s KPI) + tab-visibility pause. NO WebSocket in Phase 4 (deferred to Phase 5 polish). Pitfall #13 escape rules wired as CI grep guards: no `'use cache'` on dynamic pages (chat/calls/orders/orders/[id]); `'use cache'` ALLOWED on /default + /analytics (KPI aggregated); `border-border` explicit (Tailwind v4 default change); no sync `cookies()/headers()/params/searchParams`. Backend handlers in `apps/api/src/routes/{leads,orders,trucks,clients,analytics,calls}.ts` ALL flipped from 501-stub to real (API-03/04/05/06/09 closed); NEW `GET /api/calls + /:id` route (ADMIN-NEW-08); NEW `OrderListItemSchema` extends OrderSchema with joined city + client + channel; NEW `ExtendedOrderDetailSchema` extends OrderDetail with client + fromCity + toCity + truck. Multi-channel chat = UNION of `messages` + `calls.transcript` jsonb turns ordered by `created_at` ASC. Recharts (already in Zenith) wired through `'use client'` boundary per Pitfall #6. i18n RU/UA via Zustand `usePreferencesStore.language` + `apps/web/src/lib/i18n/dict.ts` + `useT()` hook; ICU + date-fns/locale deferred to Phase 5 (I18N-03/04). 6 dashboard pages live (default/analytics/chat/calls/orders/orders/[id]); 4 Zenith pages hidden from sidebar but kept in build (kanban/fleet/calendar/tracking — deferred to v2). 13 reqs flipped from Pending to Complete: API-03/04/05/06/09 + ADMIN-01/02/03/05 + ADMIN-NEW-02/03/08 + I18N-02.
```

Step 6 — Create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md`:

```markdown
# Phase 4 — Admin Web (REDUCED scope — chat + calls + orders + KPI) — Phase Summary

**Phase:** 4
**Status:** Complete (pending UAT-05 sign-off)
**Started:** 2026-06-10
**Completed:** 2026-06-10
**Risk profile:** MEDIUM (Pitfall #13 — Next.js 16 + Tailwind v4 + shadcn integration traps)

## Scope (what was promised)

Demo-supporting admin showing what voice + Telegram channels produced: multi-channel chat (Telegram threads + voice transcripts with inline audio), calls table with filters and audio/transcript drill-down, orders table + detail page, KPI dashboards.

13 requirements:
- API-03 — GET /api/leads (filter by stage + channel)
- API-04 — GET /api/orders + /:id (joined)
- API-05 — GET /api/trucks (read-only)
- API-06 — GET /api/clients/:id/messages (UNION telegram + voice transcript turns)
- API-09 — GET /api/analytics/kpi (extended schema)
- ADMIN-01 — Fork Zenith template (`mahooo0/next-shadcn-admin-dashboard`)
- ADMIN-02 — Auth via `/auth/v1/login` (env-set login/password, single-user)
- ADMIN-03 — `/dashboard/chat` multi-channel
- ADMIN-05 — `/dashboard/default` + `/dashboard/analytics` KPI
- ADMIN-NEW-02 — `/dashboard/orders` table
- ADMIN-NEW-03 — `/dashboard/orders/[id]` detail + timeline
- ADMIN-NEW-08 — `/dashboard/calls` table + detail modal
- I18N-02 — Customize-panel RU/UA toggle + dictionary

## What shipped

| Plan | Wave | Highlights |
|------|------|-----------|
| 04-00 | 0 | Test infra: apps/web vitest + happy-dom + @testing-library/react + 7 integration scaffolds + 13 phase-4-stub markers |
| 04-01 | 1 | Zenith vendored: full src/ + public/ + components.json + tailwind/postcss/next/tsconfig copy. VENDOR.md records exact git SHA. pnpm workspace merge. Phase 1 placeholder removed. |
| 04-02 | 2 | Auth via `proxy.ts` (Next.js 16 native — Pitfall #4); bcryptjs + jose; login/logout routes; lib/api.ts (server/client auto-routing fetcher); lib/i18n/dict.ts + useT() hook; sidebar trimmed to 5 nav items (D-49). |
| 04-03 | 1 (parallel with 04-02) | Backend handlers: 6 routes flipped from 501-stub. NEW `apps/api/src/routes/calls.ts`. NEW `OrderListItemSchema` + `ExtendedOrderDetailSchema` + extended `KpiResponseSchema`. UNION query in `GET /api/clients/:id/messages`. |
| 04-04 | 3 | `/dashboard/chat` near-rewrite of Zenith mock-chat → real UNION + audio seek + manager intercept; `/dashboard/calls` new (table + filters + modal + audio seek). ADMIN-03 + ADMIN-NEW-08 flipped. |
| 04-05 | 3 (parallel with 04-04) | `/dashboard/orders` + `/orders/[id]` new pages; `/dashboard/default` + `/dashboard/analytics` rewired to KPI API; 5 recharts with `'use client'` boundary. ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05 flipped. |
| 04-06 | 4 | README updates + apps/web/README + HUMAN-UAT-05 + VALIDATION sign-off + REQUIREMENTS traceability flip + STATE entry + checkpoint:human-verify. |

## Tests

- **Frontend (NEW for Phase 4):** `pnpm --filter @ai-logist/web test` — vitest + happy-dom + RTL; static-rules grep guards (5) + pages-smoke (6) + i18n (3) + auth (4)
- **Backend integration:** `pnpm --filter @ai-logist/api test:integration` — 7 new files (leads-list / orders-list / orders-detail / trucks-list / clients-messages-union / analytics-kpi / calls-list)
- **Stub markers:** 13 → 0 (monotonically decreasing per wave)

## Pitfall #13 escape

All trip-wires defused:
- No `'use cache'` on /chat, /calls, /orders, /orders/[id] (grep guard CI)
- `'use cache'` allowed on /default + /analytics (KPI aggregated)
- `border-border` explicit everywhere (grep guard CI)
- Server/client boundary correct: page.tsx is always server; _components/* are client when needed
- Next.js 16 async `cookies()/headers()/params/searchParams` — no sync usage (grep guard CI)

## Files created

- 50+ source files in `apps/web/src/` (Zenith vendored + 6 new dashboard pages + their _components)
- 7 backend integration test files
- 12 frontend unit test files
- 1 new backend route: `apps/api/src/routes/calls.ts`
- 1 new shared-types module: `packages/shared-types/src/api/calls.ts`
- Extended: `packages/shared-types/src/api/{orders,analytics}.ts`

## Commits

(populated by /gsd:execute-phase — each task commits atomically)

## What's deferred (to v2 per 2026-06-09 pivot)

- ADMIN_V2-KANBAN — `/dashboard/kanban` with DnD
- ADMIN_V2-FLEET — fleet CRUD + libphonenumber-js phone input
- ADMIN_V2-CALENDAR — loading/unloading schedule
- ADMIN_V2-TRACKING — Leaflet + `/ws/tracking` (also blocked by Phase 5 WS)
- ADMIN_V2-SEARCH — global ⌘K
- ADMIN_V2-PRICE-OVERRIDE — modal with audit reason
- ADMIN_V2-TTN-PDF — TTN/CMR PDF generator stub
- ADMIN_V2-ORDER-CREATE — POST /api/orders manual order creation
- WS push (`/ws/inbox`, `/ws/tracking`) — Phase 5 polish
- ICU pluralization + date-fns/locale — Phase 5 (I18N-03 + I18N-04)

## UAT-05 outcome

PENDING — see `HUMAN-UAT-05.md` for 8-step protocol. Expected ~15 min on a clean docker stack.

---

*Phase 4 complete: 2026-06-10. Next phase: 5 — Demo Polish + Notifications + Final i18n.*
```

Step 7 — Render `checkpoint:human-verify` so executor halts:

```
checkpoint:human-verify
```

Include in plan output a clear message:

> ## ⏸ Human verification required (UAT-05)
>
> Phase 4 implementation is complete. Before this phase is marked CLOSED, follow the protocol in `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md` (~15 min).
>
> When UAT-05 passes, run `/gsd:transition` to close Phase 4 and advance to Phase 5.

Commit message: `docs(04-06): phase 4 closure — VALIDATION + STATE + REQUIREMENTS flips + PHASE-SUMMARY + checkpoint`.
  </action>
  <verify>
    <automated>
TODO_COUNT=$(grep -c "test\.todo" apps/api/tests/unit/phase-4-stubs.test.ts || echo 0) && \
test "$TODO_COUNT" -eq 0 && \
grep -q "nyquist_compliant: true" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md && \
grep -q "wave_0_complete: true" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md && \
test -f .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md && \
grep -q "Phase 4" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md && \
grep -q "ADMIN-NEW-08" .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md && \
grep -q "Phase 4 (Admin Web REDUCED)" .planning/STATE.md && \
for r in API-03 API-04 API-05 API-06 API-09 ADMIN-01 ADMIN-02 ADMIN-03 ADMIN-05 ADMIN-NEW-02 ADMIN-NEW-03 ADMIN-NEW-08 I18N-02; do \
  grep -E "^\| ${r} \|.+\| Complete \|" .planning/REQUIREMENTS.md > /dev/null || { echo "FAIL: ${r} not Complete"; exit 1; }; \
done && \
echo "all checks pass"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/api/tests/unit/phase-4-stubs.test.ts` has 0 `test.todo` markers (grep returns 0)
    - `apps/web/tests/unit/static-rules.test.ts` — all 5 grep guards still green
    - `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md` frontmatter has `nyquist_compliant: true` AND `wave_0_complete: true` AND `status: complete`
    - `.planning/REQUIREMENTS.md` traceability table shows all 13 Phase 4 reqs as `Complete` (API-03, API-04, API-05, API-06, API-09, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-05, ADMIN-NEW-02, ADMIN-NEW-03, ADMIN-NEW-08, I18N-02)
    - `.planning/REQUIREMENTS.md` "Validated" section has a Phase 4 entry summarizing the 13 shipped reqs (mirroring Phase 3 + 3.1 entries)
    - `.planning/STATE.md` "Key Decisions" has a new Phase 4 entry at the top of the decisions list
    - `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-PHASE-SUMMARY.md` exists, mirrors 03.1-PHASE-SUMMARY.md shape, includes "Scope / What shipped / Tests / Pitfall escape / Files / Commits / Deferred / UAT-05 outcome PENDING"
    - Plan output ends with `checkpoint:human-verify` marker AND a human-readable instruction to run HUMAN-UAT-05
  </acceptance_criteria>
  <done>
Phase 4 documentation, validation, traceability, and state-tracking all sealed. UAT-05 awaits human run. Phase is CLOSED-pending-UAT — `/gsd:transition` after UAT-05 PASS moves to Phase 5.
  </done>
</task>

</tasks>

<verification>
- All 8 task-level acceptance criteria above pass
- `pnpm -r test` exits 0
- `pnpm --filter @ai-logist/web build` exits 0
- `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/api exec tsc --noEmit` exits 0
- `pnpm exec biome check` exits 0
- 0 `test.todo` in phase-4-stubs.test.ts
- 5/5 static-rules grep guards green
- 13/13 Phase 4 reqs marked Complete in REQUIREMENTS.md
</verification>

<success_criteria>
- README admin section + apps/web/README.md + HUMAN-UAT-05.md all created and cross-linked
- VALIDATION.md sign-off (nyquist_compliant: true)
- STATE.md + REQUIREMENTS.md flipped to reflect Phase 4 closure
- 04-PHASE-SUMMARY.md captures everything
- `checkpoint:human-verify` halts execution at UAT-05 gate
</success_criteria>

<output>
After this plan completes, no further plans are needed for Phase 4. The user must run HUMAN-UAT-05 manually (~15 min). On PASS, `/gsd:transition` closes Phase 4 and advances STATE.md to Phase 5.
</output>
