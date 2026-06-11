# Phase 5 — NOTIF-01 + NOTIF-02 Audit Report

**Date:** 2026-06-11
**Auditor:** Plan 05-01 executor (sonnet, 1M ctx)
**Plan:** `.planning/phases/05-demo-polish-notifications-final-i18n/05-01-notif-audit-PLAN.md`

## Verdict: **PASS (as-designed)**

NOTIF-01 + NOTIF-02 wiring contract is honored. All three notification transitions
(DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED) are first-class on the
`renderNotificationTemplate` + `notifyClient` side (Phase 3 D-24/D-26). The
production source has exactly one `transitionOrder` call site today
(`tryAdvanceOrderAfterCreation` in `apps/api/src/channels/telegram/adapter.ts`)
that fires the `notifyClient({ transition: 'DRIVER_ASSIGNED' })` onSuccess
hook. The remaining two transitions (IN_TRANSIT, DELIVERED) have
**no production caller in v1** — by design, per Phase 5 CONTEXT §domain and
ROADMAP §scope: geofence-driven LOADED/UNLOADED transitions are **deferred to
v2** (`v2 TRACK_V2-*`). Plan 05-01 Task 2 wires the integration test to
directly invoke `transitionOrder({ to: 'IN_TRANSIT' | 'DELIVERED', onSuccess:
notifyClient(transition) })` to prove the contract for v2 (and for any manager
who manually advances orders via admin).

This matches the plan's `must_haves.truths` row 6:
> Per D-01: NO production code changes in this wave — pure audit. If audit
> reveals a missing transition or hook, Plan 05-01 ADDS the missing wire-up
> (rare — Phase 3 STATE.md says all 3 already wired).

STATE.md said "Phase 3 ALL PLANS complete: … 03-04 (Wave 4
notifications+driver-FSM-hook: TG-05 + TG-07; ORDER_TRANSITIONS gains
DRIVER_ASSIGNED→CLOSED edge; transitionOrder onSuccess post-commit hook;
adapter-driven tryAdvanceOrderAfterCreation helper)" — which is precisely
DRIVER_ASSIGNED only. The phrase "all 3" was slightly imprecise in PROJECT.md
("Client notifications: hook on order FSM transitions (DRIVER_ASSIGNED,
IN_TRANSIT, DELIVERED) — i18n RU/UA, skip если нет telegram_id") — the
**templates** ship for all 3 transitions; the **onSuccess wire-up** ships only
for DRIVER_ASSIGNED in v1 because v1 has no geofence/manual driver of
IN_TRANSIT or DELIVERED status changes. Phase 5 audit confirms this is
intentional and matches the v1 ROADMAP.

**Plan 05-01 outcome:** Wave 1 is AUDIT-ONLY per D-01. No production-code
modifications added. The integration scaffold flip in Task 2 proves the
notifyClient contract for all 3 transitions (so v2 / admin-manual-advance
paths inherit a verified wiring contract).

---

## Check 1 — ORDER_TRANSITIONS table edges

File: `apps/api/src/pipeline/lifecycle/order-fsm.ts` lines 37–50

| Edge                                | Line  | Status                             |
| ----------------------------------- | ----- | ---------------------------------- |
| `CREATED → DRIVER_ASSIGNED`         | 38    | PASS                               |
| `DRIVER_ASSIGNED → AT_LOADING`      | 44    | PASS (full lifecycle path)         |
| `DRIVER_ASSIGNED → CLOSED`          | 44    | PASS (driver_decline; Phase 3 D-19)|
| `AT_LOADING → IN_TRANSIT`           | 45    | PASS                               |
| `IN_TRANSIT → AT_BORDER`            | 46    | PASS (international leg)           |
| `IN_TRANSIT → DELIVERED`            | 46    | PASS                               |
| `AT_BORDER → IN_TRANSIT`            | 47    | PASS (cleared customs)             |
| `DELIVERED → CLOSED`                | 48    | PASS                               |

All 8 edges present. The 3 NOTIF-01 transitions (DRIVER_ASSIGNED, IN_TRANSIT,
DELIVERED) are all reachable from the table.

`STATUS_TO_EVENT` (lines 61–69) maps each status to a lowercase
`order_event_type` enum value (Phase 1 schema); CLOSED maps to `null` because
Phase 1's enum has no `closed` value.

## Check 2 — notifyClient invocation on each transition

| Transition        | Call site (`onSuccess` → `notifyClient`)                                          | Status                        |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `DRIVER_ASSIGNED` | `apps/api/src/channels/telegram/adapter.ts:189-210` (`tryAdvanceOrderAfterCreation`) | PASS                          |
| `IN_TRANSIT`      | None in `apps/api/src/` (v1)                                                      | DEFERRED to v2 (per ROADMAP)  |
| `DELIVERED`       | None in `apps/api/src/` (v1)                                                      | DEFERRED to v2 (per ROADMAP)  |

`tryAdvanceOrderAfterCreation` is invoked from both text path
(`processTelegramUpdate` line 156 of adapter.ts) and the callback path
(`handlers.ts:108`). Both code paths funnel through the same helper.

The IN_TRANSIT/DELIVERED transitions cannot fire in v1 because:
1. AT_LOADING → IN_TRANSIT requires a geofence event ("truck arrived at
   loading point") — Phase 5 CONTEXT §Out of Scope: "Geofence-driven
   LOADED/UNLOADED transitions — v2".
2. IN_TRANSIT → DELIVERED requires geofence at destination — same v2 scope.
3. Manager-driven manual advancement from `/dashboard/orders/:id` — Phase 4
   D-37 explicitly: "read-only (D-37 — NO actions in v1)".

`notifyClient` signature itself supports all 3 transitions
(`apps/api/src/channels/telegram/notifications.ts:30-36`); call sites for
IN_TRANSIT/DELIVERED inherit zero-modification wiring when v2 or manual
admin actions land.

## Check 3 — NOTIF-02 grep guard (no `/track/`)

Command:
```bash
grep -nE "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts
```

Result: **zero matches.** Exit code 1 (no lines found). PASS.

The templates already drop public tracking link references — RU/UA strings
in `renderNotificationTemplate` reference only `order_number`, `plate_number`,
`driver_name`, `driver_phone`. No URL, no token, no link.

## Check 4 — `renderNotificationTemplate` handles 3 transitions × 2 langs

File: `apps/api/src/lib/i18n.ts` lines 35–46

Manual render outputs for `row = { number: 'KU-4471', plate_number: 'AA0001AB', driver_name: 'Иван', driver_phone: '+70000000001' }`:

**DRIVER_ASSIGNED — ru:**
```
🚚 Машина назначена! Заказ KU-4471.
Номер: AA0001AB.
Водитель: Иван, +70000000001.
```

**DRIVER_ASSIGNED — ua:**
```
🚚 Машину призначено! Замовлення KU-4471.
Номер: AA0001AB.
Водій: Иван, +70000000001.
```

**IN_TRANSIT — ru:** `📦 Груз в пути. Заказ KU-4471.`
**IN_TRANSIT — ua:** `📦 Вантаж у дорозі. Замовлення KU-4471.`
**DELIVERED — ru:** `✅ Доставлено! Заказ KU-4471. Спасибо за заказ.`
**DELIVERED — ua:** `✅ Доставлено! Замовлення KU-4471. Дякуємо за замовлення.`

All 6 templates render without throwing. Missing fields fall back to `—` em-dash
(see line 37 nullish-coalescing operator). PASS.

## Check 5 — `clients.telegram_id` NULL skip-silent

File: `apps/api/src/channels/telegram/notifications.ts:148-151`

```typescript
if (!row.telegram_id) {
  log.info({ orderId }, 'notifyClient: client has no telegram_id — skip');
  return;
}
```

PASS — function returns silently (logs at `info` level, not `warn` or `error`).
Matches Phase 3 D-26 contract.

Cross-reference: `client-notifications.test.ts:131-185` (Phase 3 integration
test "client without telegram_id → notifyClient skips silently") already
asserts this behavior end-to-end with a mock bot.

## Check 6 — One number per notification (ROADMAP success criterion #1)

Each template substring contains exactly ONE numerical field (the order
number) plus optional plate_number + driver_phone (factual, not paraphrased):

- DRIVER_ASSIGNED: `${row.number}` + `${row.plate_number ?? '—'}` + `${row.driver_phone ?? '—'}` — all sourced directly from the DB row, no LLM paraphrase
- IN_TRANSIT: `${row.number}` only
- DELIVERED: `${row.number}` only

PASS. Anti-Pitfall #1 invariant preserved (price-lock not in scope for status
notifications; transition templates contain no price field).

---

## Recommendations

1. **Plan 05-01 Task 2** flips `notif-fsm-transitions.test.ts` scaffold to 3
   `it()` blocks asserting each transition fires `notifyClient` via the
   `transitionOrder` `onSuccess` hook. The test directly invokes
   `transitionOrder` for each transition (no need to wait for v2 production
   callers). This locks the wiring contract for v2.

2. **Plan 05-01 Task 2** flips `i18n-no-track-link.test.ts` scaffold to a
   `readFileSync`-based grep guard asserting no `/track/`, `trackingUrl`, or
   `public_token` substrings remain in `apps/api/src/lib/i18n.ts`.

3. **No production-code changes in Wave 1** — audit verdict PASS-as-designed
   per CONTEXT D-01/D-02. Marker count in `phase-5-stubs.test.ts` stays at
   11 per VALIDATION.md Wave 1 row.

4. **Future-work flag for v2 (not Phase 5):** when `TRACK_V2-*` lands, the
   geofence handler must invoke `transitionOrder({ to: 'IN_TRANSIT' | 'DELIVERED',
   onSuccess: () => notifyClient({ transition: ..., db, bot, log }) })` —
   the exact same pattern as DRIVER_ASSIGNED in adapter.ts. The integration
   test established in Wave 1 will then catch any regression.

---

*Audit complete. Verdict: PASS (as-designed). Plan 05-01 Wave 1 proceeds to
Task 2 (scaffold flips) with zero production-code modifications.*
