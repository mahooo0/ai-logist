# Phase 4 — Human Acceptance Test (UAT-05)

> **Target:** confirm the admin dashboard shows what the voice + Telegram channels produced, end-to-end, on a clean machine.
> **Duration:** ~15 minutes
> **Prerequisites:** completed UAT-03 (Telegram) and UAT-04 (Voice) at least once

This protocol exercises Phase 1 + 2 + 3 + 3.1 + 4 together — the full demo storyboard.

## Pre-flight

```bash
docker compose down -v          # nuke any prior state
docker compose up -d --build    # rebuild + start fresh
sleep 5
curl -sS http://localhost:8080/api/health | jq .
# expect: { "ok": true, "checks": { "db": "ok", "postgis": "PostGIS_Version()...",
#                                   "telegram": "ok", "voice": "ok" } }
pnpm --filter @ai-logist/api db:seed   # idempotent seed
```

Pre-flight checklist:

- [ ] `docker compose ps` shows all 5 services healthy (postgres, redis, api, web, caddy)
- [ ] `apps/web/.env.local` has `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_COOKIE_SECRET`, `API_INTERNAL_URL`
- [ ] `apps/api/.env.local` has Telegram + Voice env vars from UAT-03 + UAT-04
- [ ] `curl -sS http://localhost:8080/api/health | jq .checks.telegram` → `"ok"`
- [ ] `curl -sS http://localhost:8080/api/health | jq .checks.voice` → `"ok"`

## Step 1 — Login

1. Open `http://localhost:8080/` in browser.
2. Expected: 302 redirect to `/auth/v1/login`.
3. Enter `admin` + your password (from your `.env.local` `ADMIN_PASSWORD_HASH` source).
4. Expected: lands on `/dashboard/default` with KPI tiles + last-5 lists.

✅ **Pass criterion:** No console errors; KPI tiles render with real numbers from `/api/analytics/kpi`.

## Step 2 — Navigate 6 pages

Click through:

1. `/dashboard/default` — KPI tiles + last-5 calls + last-5 orders.
2. `/dashboard/analytics` — 5 recharts (funnel, channel split, revenue, calls per day, avg duration); window selector (day/week/month) updates `?window=` and re-renders charts.
3. `/dashboard/chat` — empty thread list initially (no clients yet).
4. `/dashboard/calls` — empty table + filter bar.
5. `/dashboard/orders` — empty table + filter bar.
6. (`/dashboard/orders/[id]` exercised after Step 3 / Step 4 produce real orders.)

✅ **Pass criterion:** All pages render without errors. Sidebar shows only the 5 v1 nav items (no Kanban / Fleet / Calendar / Tracking — D-49). Customize panel reachable from top-right.

## Step 3 — Telegram lead end-to-end (replay UAT-03)

Send the canonical RU script to the bot from your real Telegram account:

```
Привет
Киев-Львов, 18 тонн, тент
Подтверждаю
```

Watch in admin:

- `/dashboard/chat` left rail gains a new thread (TG icon).
- Click it → right pane shows TG-badged messages chronologically.
- `/dashboard/calls` stays empty (this is Telegram, not voice).
- `/dashboard/orders` gains 1 row (`CREATED` → possibly `DRIVER_ASSIGNED` if `driver_telegram_id` is seeded).

✅ **Pass criterion:** chat thread + order row both visible; SWR polling updates within 15s without manual refresh.

## Step 4 — Voice lead end-to-end (replay UAT-04 — gated, costs ~$1)

Make 1 real Twilio call. After hang-up:

- `/dashboard/calls` gains 1 row with `outcome='completed'`, `lang='ru'`.
- Click row → modal opens with audio player + scrollable transcript.
- Press Play → audio streams from Twilio recording URL.
- Click any transcript turn → audio seeks to that timestamp (D-26).
- `/dashboard/chat` thread for this client (by phone) shows Voice-badged transcript turns interleaved chronologically with TG (if any).

✅ **Pass criterion:** modal opens < 500ms; audio plays; turn-click seek works; chat unifies channels under one client thread.

## Step 5 — Order detail breadcrumb

From `/dashboard/orders`, click the order row from Step 3 (Telegram) → `/dashboard/orders/[id]`:

- Header: order number + status + price.
- Channel breadcrumb: **"Открыть диалог"** → routes back to chat for this client.
- Left column: client / route / truck / cargo cards.
- Right column: vertical event timeline with type + actor pill + timestamp + payload `<details>`.

Then click the order from Step 4 (Voice):

- Channel breadcrumb: **"Прослушать звонок"** → routes to `/dashboard/calls?openCall=<callId>`.

✅ **Pass criterion:** breadcrumb logic correct per D-38; timeline shows `order_events` chronologically.

## Step 6 — Manager intercept

In `/dashboard/chat` with a Telegram thread active and `lead.manager_active=false`:

1. Click **`Перехватить`** button → header changes; input box becomes "Сообщение от менеджера".
2. Type a message → send → confirm Telegram client receives it (bot relays via `POST /api/leads/:id/manager-message`).
3. Click **`Вернуть боту`** → `manager_active=false` again; bot replies "Передаю обратно AI-ассистенту".

✅ **Pass criterion:** intercept flow works end-to-end through Phase 3 endpoints. Voice threads NEVER show intercept buttons (D-47).

## Step 7 — RU/UA toggle

Open Customize panel (top-right) → switch language to UA:

- Chat header label flips to **"Перехопити"**.
- Calls filter labels translate.
- Orders columns translate.
- Refresh page → preference persists (Zustand + localStorage).

Switch back to RU. Both directions must work.

✅ **Pass criterion:** I18N-02 round-trip works; no missing keys visible as raw `chat.intercept` strings.

## Step 8 — Pitfall #13 grep guards + Phase 4 stub gate

```bash
pnpm --filter @ai-logist/web test -t "static-rules"
```

Expected: 5 grep guards GREEN
- no `'use cache'` on dynamic pages
- no bare `border` without `border-border`
- no sync `cookies()/headers()/params/searchParams`
- no `'use client'` on dashboard `page.tsx`
- `proxy.ts` matcher correct

```bash
pnpm --filter @ai-logist/api test:unit -t "Phase 4"
```

Expected: all 13 Phase 4 assertions passed + **0 todo**.

```bash
grep -c 'test\.todo' apps/api/tests/unit/phase-4-stubs.test.ts
# → 0
```

✅ **Pass criterion:** all 3 commands green.

---

## Sign-off

- [ ] Step 1 — Login passes
- [ ] Step 2 — All 6 pages reachable + no console errors
- [ ] Step 3 — Telegram lead end-to-end (admin reflects it within 15s)
- [ ] Step 4 — Voice call end-to-end (audio + transcript + seek work)
- [ ] Step 5 — Order detail breadcrumb routes to correct channel destination
- [ ] Step 6 — Manager intercept round-trip works
- [ ] Step 7 — RU↔UA toggle flips chat / calls / orders labels
- [ ] Step 8 — Pitfall #13 + Phase 4 stub gates all green

**Reviewer:** _______
**Date:** _______
**Outcome:** PASS / FAIL (note any deviations below)

## Rollback (if UAT-05 fails)

If a step fails, capture diagnostics:

1. Browser console errors (`Cmd+Opt+J`).
2. Network tab for failed `/api/*` requests (status + response body).
3. `docker compose logs --tail 100 api web` output.
4. Phase 4 stub counts: `grep -c "test\.todo" apps/api/tests/unit/phase-4-stubs.test.ts`.
5. Static-rules: `pnpm --filter @ai-logist/web test -t "static-rules" 2>&1 | tail -50`.

Open a GSD bug session: `/gsd:debug "Phase 4 UAT-05 failure: <step>"`.

If the failure is environmental (Docker / env vars), restart from pre-flight; if it's code, file the bug and roll back the offending plan commit before re-running.

---

*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Authored: 2026-06-10 (Phase 4 closure)*
