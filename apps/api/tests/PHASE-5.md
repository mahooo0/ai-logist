# Phase 5 — Demo Polish + Notifications + Final i18n Testing Architecture

## Wave-by-wave flip schedule (phase-5-stubs.test.ts)

| Wave | Plan    | Flipped this wave                                              | Markers remaining |
| ---- | ------- | -------------------------------------------------------------- | ----------------- |
| 0    | 05-00   | — (11 created — baseline seed)                                 | 11                |
| 1    | 05-01   | — (NOTIF audit; verifies Phase 3 wiring; no marker flips)      | 11                |
| 2    | 05-02   | I18N-01, I18N-03, I18N-05                                      | 8                 |
| 3    | 05-03   | POLISH-01, NOTIF-01, NOTIF-02, I18N-04                         | 4                 |
| 4    | 05-04   | POLISH-02, POLISH-05, POLISH-06                                | 1                 |
| 5    | 05-05   | POLISH-03                                                      | 0                 |

Verifier gate after each wave:

```bash
grep -c "test\.todo" apps/api/tests/unit/phase-5-stubs.test.ts
```

Expected monotonic decrease: `11 → 11 → 8 → 4 → 1 → 0`.

## Test architecture overview

Phase 5 testing spans THREE layers (mirrors Phase 4 architecture; no new
infrastructure was installed for Phase 5):

### (a) Backend integration via testcontainers PostGIS 17-3.5

Each integration scaffold is gated by `describe.skipIf(!dockerAvailable)`
(local declaration per-file — established Phase 3 convention) so
`AI_LOGIST_NO_DOCKER=1` skips cleanly. Each Wave 0 scaffold ships exactly
one pending marker — Wave 3 + Wave 4 plans flip the marker to `it()` calls
without restructuring the file.

| File                                  | Wave that flips | Production code under test                                 |
| ------------------------------------- | --------------- | ---------------------------------------------------------- |
| notif-fsm-transitions.test.ts         | 3 (05-03)       | apps/api/src/persistence/order-fsm.ts onSuccess hook fires |
| simulate-call.test.ts                 | 4 (05-04)       | apps/api/src/routes/admin.ts (POST /simulate-call)         |

### (b) Backend unit (apps/api/tests/unit + apps/api/tests/snapshots)

Phase 5 adds 7 unit scaffolds + 2 snapshot scaffolds — every requirement
gets a pending marker that the matching plan wave flips:

| File                                  | Wave that flips | Requirement                                  |
| ------------------------------------- | --------------- | -------------------------------------------- |
| i18n-dict.test.ts                     | 2 (05-02)       | I18N-01 — renderBotReply 11 keys × 2 langs  |
| i18n-no-track-link.test.ts            | 3 (05-03)       | NOTIF-02 grep guard                          |
| icu-plural.test.ts                    | 2 (05-02)       | I18N-03 — 60 assertions (CLDR plural rules)  |
| llm-provider-adapter.test.ts          | 4 (05-04)       | POLISH-06 — Anthropic + OpenAI adapter parity|
| declension-grep.test.ts               | 2 (05-02)       | I18N-05 — no genitive case forms             |
| preflight-script-shape.test.ts        | 4 (05-04)       | POLISH-05 — script shape + 6 sequential checks|
| snapshots/extract-request.snap.ts     | 3 (05-03)       | POLISH-01 — 20 canonical extractRequest      |
| snapshots/calc-price.snap.ts          | 3 (05-03)       | POLISH-01 — 10 calcPrice combos              |

Snapshot files materialise under `apps/api/tests/snapshots/__snapshots__/`
which Wave 0 commits empty via `.gitkeep` so the directory tracks in git.

### (c) Frontend unit via vitest + happy-dom (apps/web/tests/unit)

Phase 5 adds two web unit scaffolds, both flipped in later waves:

| File                                  | Wave that flips | Requirement                                  |
| ------------------------------------- | --------------- | -------------------------------------------- |
| format-date-locale.test.ts            | 3 (05-03)       | I18N-04 — RU "8 июн, ср" + UA "8 чер, ср"   |
| voice-fallback-asset.test.ts          | 5 (05-05)       | POLISH-03 — MP4 size + magic + WebVTT       |

## Phase 1-3.1 contract (must remain bit-identical)

Phase 5 is strictly additive polish. Across every Wave 0..5 commit:

```bash
git diff apps/api/src/pipeline/llm-tools/ apps/api/src/channels/voice/ apps/api/src/persistence/schema/
```

must be empty. The expected production touches are:

- Wave 2: extend `apps/api/src/lib/i18n.ts` + new `apps/api/src/lib/icu.ts`
- Wave 3: extend `apps/api/src/persistence/order-fsm.ts` ORDER_TRANSITIONS (add IN_TRANSIT + DELIVERED if missing, NOT a rewrite); extend `apps/api/src/channels/telegram/notifications.ts` for new transitions; extend `apps/web/src/lib/format.ts`
- Wave 4: new `apps/api/src/routes/admin.ts` + `apps/api/src/lib/llm/{provider,anthropic-adapter,openai-adapter}.ts` + `apps/api/scripts/preflight.ts`
- Wave 5: new `apps/web/public/demo/voice-fallback.{mp4,ru.vtt}` + `apps/web/src/app/(main)/dashboard/calls/_components/{simulate-call-modal,voice-fallback-modal}.tsx`

## Comment hygiene reminder

NO file in `apps/api/tests/` may contain the literal marker-function substring
in comments or docstrings — the verifier uses naive `grep -c`. Keep that
substring strictly as a code-only occurrence inside the marker call itself.

This rule has been re-burned seven times now (Phase 1 Plan 01-10, Phase 2
Plans 02-03b / 02-04a / 02-04b, Phase 3 Plan 03-00, Phase 3.1 Plan 03.1-00,
Phase 4 Plan 04-00). Avoid the eighth.

## Test commands

- Unit (backend): `pnpm --filter @ai-logist/api test:unit`
- Integration (backend, Docker): `pnpm --filter @ai-logist/api test:integration`
- Skip integration: `AI_LOGIST_NO_DOCKER=1 pnpm --filter @ai-logist/api test`
- Snapshot stability: `pnpm --filter @ai-logist/api test:snapshot` (10× loop)
- Frontend unit: `pnpm --filter @ai-logist/web test`
- Full repo: `pnpm -r test`

## CI grep guards (Wave 1 onward)

After Wave 1 + Wave 3 land, the following bash gate runs against the
production source:

```bash
# NOTIF-02: confirm no public tracking link reaches notification templates
grep -E "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts && exit 1 || exit 0
```

## UAT-06 (Phase 5 close)

UAT-06 lives in `.planning/HUMAN-UAT.md` after Plan 05-05 runs. Covers:

- Real Telegram notification delivery for DRIVER_ASSIGNED → IN_TRANSIT → DELIVERED.
- `pnpm preflight` against real demo credentials (≤30s, all 6 checks green).
- `voice-fallback.mp4` plays in browser with RU caption track.
- `LLM_PROVIDER=openai` failover swap procedure (≤30s).
- `Simulate inbound call` button across all 5 scenarios.

Items unverifiable in unit + integration tests are deferred to UAT-06.
