---
phase: 05-demo-polish-notifications-final-i18n
plan: 00
subsystem: testing
tags: [vitest, testcontainers, happy-dom, scaffolds, monotonic-baseline, phase-5]

# Dependency graph
requires:
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    provides: apps/web vitest + happy-dom + RTL infrastructure (Plan 04-00); apps/api vitest projects (unit/integration/smoke) + testcontainers PostGIS 17-3.5 + fake-timers preset
  - phase: 03.1-voice-channel-elevenlabs-twilio
    provides: voice-scenarios.json + MockElevenLabsClient + replayVoiceScenario harness (reused by simulate-call.test.ts in Wave 4)
  - phase: 03-telegram-channel
    provides: Phase 3 lib/i18n.ts renderNotificationTemplate + channels/telegram/notifications.ts notifyClient (audited by Wave 1 + extended Wave 3)
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: FIXED_NOW fake-timer + canonical-inputs.json (20 entries) + MockAnthropicClient (reused by Wave 3 snapshot tests)
provides:
  - "11 pending markers in apps/api/tests/unit/phase-5-stubs.test.ts establishing monotonic verifier baseline 11 → 11 → 8 → 4 → 1 → 0"
  - "12 scaffold files each carrying exactly 1 pending marker for Wave 1-5 flips"
  - "apps/api/tests/snapshots/__snapshots__/.gitkeep — tracked empty directory for Wave 3 snapshot files"
  - "apps/api/tests/PHASE-5.md — wave-by-wave flip schedule + 3-layer architecture + CLI commands + comment hygiene reminder"
affects: [05-01-notif-audit, 05-02-i18n-core, 05-03-snapshot-format-date, 05-04-simulate-adapter-preflight, 05-05-video-uat-gate]

# Tech tracking
tech-stack:
  added: []  # Phase 5 Wave 0 ships test infra ONLY — no new deps; Phase 4 Wave 0 already installed vitest 4 + happy-dom + RTL
  patterns:
    - "Phase 5 stub-file monotonic decrease pattern (mirror of Phase 1/2/3/3.1/4 conventions)"
    - "Scaffold-per-requirement: each pending marker lives in its own dedicated scaffold file so wave plans flip without restructuring"
    - "Snapshot directory committed via .gitkeep so Wave 3 has a tracked target"

key-files:
  created:
    - apps/api/tests/unit/phase-5-stubs.test.ts
    - apps/api/tests/unit/i18n-dict.test.ts
    - apps/api/tests/unit/i18n-no-track-link.test.ts
    - apps/api/tests/unit/icu-plural.test.ts
    - apps/api/tests/unit/llm-provider-adapter.test.ts
    - apps/api/tests/unit/declension-grep.test.ts
    - apps/api/tests/unit/preflight-script-shape.test.ts
    - apps/api/tests/snapshots/extract-request.snap.ts
    - apps/api/tests/snapshots/calc-price.snap.ts
    - apps/api/tests/snapshots/__snapshots__/.gitkeep
    - apps/api/tests/integration/notif-fsm-transitions.test.ts
    - apps/api/tests/integration/simulate-call.test.ts
    - apps/web/tests/unit/format-date-locale.test.ts
    - apps/web/tests/unit/voice-fallback-asset.test.ts
    - apps/api/tests/PHASE-5.md
  modified: []

key-decisions:
  - "Plan body inconsistency in scaffold count (must_haves says 8 scaffolds, plan-body TS lists 12). Followed plan-body TS as authoritative — same precedent as Plan 04-00 Wave 0. Total marker count post-Wave 0 = 11 (stubs) + 12 (scaffolds) = 23."
  - "Local-declaration dockerAvailable gate (process.env.AI_LOGIST_NO_DOCKER !== '1') used in integration scaffolds instead of the plan's suggested import from _helpers/test-db.js. test-db.ts does not export a dockerAvailable symbol — local declaration is the Phase 3+3.1+4 convention."
  - "Comment hygiene rule re-burned for the 7th time across all 15 new files — no literal pending-token substring in docstrings; verifier grep -c stays exact."

patterns-established:
  - "Stub file docstring documents wave flip sequence as a comment block (precedent: phase-3-stubs.test.ts) without using the literal marker function name"
  - "Each scaffold file is exactly one describe block + one pending marker — Wave N flips simply replace the marker call with one or more it() calls without restructuring imports or describe wrappers"
  - "Snapshot scaffolds use the .snap.ts suffix and live under apps/api/tests/snapshots/ rather than tests/unit/ — vitest picks them up via the unit project include pattern"

requirements-completed: []  # Wave 0 ships test infra; 11 plan-listed reqs flip progressively across 05-01..05-05

# Metrics
duration: ~6 min
completed: 2026-06-11
---

# Phase 05 Plan 00: Test Infra Summary

**11-marker monotonic verifier baseline + 14 test scaffolds + PHASE-5.md wave flip doc — all production code bit-identical**

## Performance

- **Duration:** ~6 min (Task 1 → ~5m30s; Task 2 → ~30s; both under standard cadence)
- **Started:** 2026-06-11T05:59:01Z
- **Completed:** 2026-06-11T06:04:34Z
- **Tasks:** 2
- **Files created:** 15 (11 test files + 1 snapshot dir keeper + 1 PHASE-5.md + 2 web unit scaffolds)
- **Files modified:** 0 (production code bit-identical)

## Accomplishments

- `apps/api/tests/unit/phase-5-stubs.test.ts` ships exactly 11 pending markers (one per Phase 5 requirement: I18N-01/03/04/05 + NOTIF-01/02 + POLISH-01/02/03/05/06). Establishes verifier monotonic decrease chain 11 → 11 → 8 → 4 → 1 → 0 across Waves 0..5.
- 8 backend unit + snapshot scaffolds (i18n-dict, i18n-no-track-link, icu-plural, llm-provider-adapter, declension-grep, preflight-script-shape, extract-request.snap, calc-price.snap) each carry exactly 1 pending marker ready for Wave 2-4 flips.
- 2 backend integration scaffolds (notif-fsm-transitions, simulate-call) gated with describe.skipIf(!dockerAvailable) so AI_LOGIST_NO_DOCKER=1 skips cleanly; each contains 1 pending marker for Wave 3-4 flips.
- 2 web unit scaffolds (format-date-locale, voice-fallback-asset) using the existing Phase 4 happy-dom config; each carries 1 pending marker for Wave 3 + Wave 5 flips.
- `apps/api/tests/snapshots/__snapshots__/.gitkeep` commits the empty directory so Wave 3 snapshot files materialise into a tracked target.
- `apps/api/tests/PHASE-5.md` documents wave-by-wave flip schedule, 3-layer test architecture, comment hygiene rule (re-burned for 8th time), and Phase 1-4 production code bit-identical contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: phase-5-stubs.test.ts + 6 unit scaffolds + 2 snapshot scaffolds + PHASE-5.md** — `52f8cdf` (test)
2. **Task 2: 2 backend integration scaffolds + 2 web unit scaffolds** — `505619c` (test)

## Files Created/Modified

### Created (15 files)

- `apps/api/tests/unit/phase-5-stubs.test.ts` — 11 pending markers + monotonic baseline doc
- `apps/api/tests/unit/i18n-dict.test.ts` — Wave 2 flips for I18N-01 (22 templates)
- `apps/api/tests/unit/i18n-no-track-link.test.ts` — Wave 3 flips for NOTIF-02 grep guard
- `apps/api/tests/unit/icu-plural.test.ts` — Wave 2 flips for I18N-03 (60 assertions)
- `apps/api/tests/unit/llm-provider-adapter.test.ts` — Wave 4 flips for POLISH-06
- `apps/api/tests/unit/declension-grep.test.ts` — Wave 2 flips for I18N-05 grep guard
- `apps/api/tests/unit/preflight-script-shape.test.ts` — Wave 4 flips for POLISH-05
- `apps/api/tests/snapshots/extract-request.snap.ts` — Wave 3 flips for POLISH-01 (20 canonical inputs)
- `apps/api/tests/snapshots/calc-price.snap.ts` — Wave 3 flips for POLISH-01 (10 combos)
- `apps/api/tests/snapshots/__snapshots__/.gitkeep` — tracked empty directory
- `apps/api/tests/integration/notif-fsm-transitions.test.ts` — Wave 3 flips for NOTIF-01
- `apps/api/tests/integration/simulate-call.test.ts` — Wave 4 flips for POLISH-02
- `apps/web/tests/unit/format-date-locale.test.ts` — Wave 3 flips for I18N-04
- `apps/web/tests/unit/voice-fallback-asset.test.ts` — Wave 5 flips for POLISH-03
- `apps/api/tests/PHASE-5.md` — wave schedule, comment hygiene, 3-layer architecture, CLI commands

### Modified (0 files)

Phase 1-4 production code (`apps/api/src/`, `apps/web/src/`, `packages/shared-types/src/`) bit-identical — `git diff --stat HEAD apps/api/src/ apps/web/src/ packages/shared-types/src/` empty across both task commits.

## Decisions Made

- **Scaffold count = 12 (plan-body TS authoritative).** Plan's must_haves listed 8 scaffolds but the plan-body TypeScript code blocks declare 12 (6 unit + 2 snapshot + 2 integration + 2 web). Followed plan-body TS as the directly-executable spec — same precedent as Plan 04-00 Wave 0. Total marker count post-Wave 0 = 11 (stubs) + 12 (scaffolds) = 23 pending markers.
- **Local-declaration dockerAvailable gate.** Plan task 2 suggested importing `dockerAvailable` from `../_helpers/test-db.js` but that module does not export the symbol — every Phase 3+3.1+4 integration test uses the local declaration `const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1'`. Maintained convention.
- **Comment hygiene preserved across all 15 new files.** Docstrings reference "pending markers" / "scaffold" / "Wave N flips" but never the literal marker-function token. Verifier `grep -c` count stays exact at 11 in phase-5-stubs.test.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] dockerAvailable not exported from test-db.ts**
- **Found during:** Task 2 — creating integration scaffolds
- **Issue:** Plan task 2 prescribed `import { dockerAvailable } from '../_helpers/test-db.js'` but `apps/api/tests/_helpers/test-db.ts` does not export that symbol — it only exports `startPostgisContainer` / `stopPostgisContainer` / `getTestDbUrl` / `getTestDb`. The Phase 3+3.1+4 convention is per-file local declaration: `const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1'`.
- **Fix:** Used local-declaration pattern in both integration scaffolds (`notif-fsm-transitions.test.ts` + `simulate-call.test.ts`). Matches every other integration test under `apps/api/tests/integration/`.
- **Files modified:** apps/api/tests/integration/notif-fsm-transitions.test.ts, apps/api/tests/integration/simulate-call.test.ts
- **Verification:** Both scaffolds skip cleanly under `AI_LOGIST_NO_DOCKER=1 pnpm test:integration`.
- **Committed in:** 505619c (Task 2 commit)

**2. [Documentation correction] Plan output spec scaffold count off-by-four**
- **Found during:** Task 2 verification
- **Issue:** Plan output section reads "11 in stubs + 8 in scaffolds = 19 total todos". Plan body declares 12 scaffolds across 14 files (the `files_modified` frontmatter lists 14 + PHASE-5.md). Real count: 11 + 12 = 23 pending markers across 13 scaffold files.
- **Fix:** Documented in SUMMARY decisions section; followed plan-body TS as authoritative. No code change needed.
- **Files modified:** N/A (documentation-only deviation)
- **Verification:** `grep -c 'test\.todo'` returns 11 in stubs file + 1 each in 12 scaffolds = 23 total. Suite still green.
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan prescription) + 1 documentation correction
**Impact on plan:** Both deviations are about plan accuracy, not execution outcome. Test scaffolds work as designed; verifier monotonic chain unchanged.

## Issues Encountered

- **Pre-existing integration suite failures** (`bourse-fallback`, `create-order-price-lock`, `health`, `nearest-truck-knn`, `seed`, `swagger`): These 6 integration tests fail under `AI_LOGIST_NO_DOCKER=1` because they call `startPostgisContainer()` unconditionally in `beforeAll` without the docker-skip gate that the rest of the integration suite uses. Confirmed pre-existing by stashing Phase 5 Wave 0 changes and re-running — failures remained identical. Out of scope for this plan; logged for separate cleanup pass. Not a regression introduced by Phase 5 Wave 0.

## User Setup Required

None — no external service configuration required for test infrastructure.

## Next Phase Readiness

- **Wave 1 (Plan 05-01) ready.** NOTIF audit plan can flip i18n-no-track-link + notif-fsm-transitions markers once the Phase 3 wiring is verified. Note: plan says Wave 1 is audit-only (0 marker flips in phase-5-stubs.test.ts); NOTIF-01 + NOTIF-02 flips in stubs file deferred to Wave 3.
- **Wave 2 (Plan 05-02) ready.** i18n core plan has i18n-dict + icu-plural + declension-grep scaffolds + intl-messageformat dep install path documented in 05-RESEARCH.md (correction noted: use `intl-messageformat` not `@formatjs/intl-messageformat`).
- **Wave 3 (Plan 05-03) ready.** Snapshot scaffolds + format-date-locale scaffold + notif-fsm-transitions integration ready for flip; `apps/api/tests/snapshots/__snapshots__/` directory tracked via .gitkeep.
- **Wave 4 (Plan 05-04) ready.** simulate-call.test.ts + llm-provider-adapter.test.ts + preflight-script-shape.test.ts scaffolds ready; openai SDK version correction documented in 05-RESEARCH.md (pin `openai@4.104.0` or negotiate `openai@^6`).
- **Wave 5 (Plan 05-05) ready.** voice-fallback-asset.test.ts scaffold ready; final POLISH-03 marker flip closes verifier chain.

## Self-Check: PASSED

### Files exist

- FOUND: apps/api/tests/unit/phase-5-stubs.test.ts
- FOUND: apps/api/tests/unit/i18n-dict.test.ts
- FOUND: apps/api/tests/unit/i18n-no-track-link.test.ts
- FOUND: apps/api/tests/unit/icu-plural.test.ts
- FOUND: apps/api/tests/unit/llm-provider-adapter.test.ts
- FOUND: apps/api/tests/unit/declension-grep.test.ts
- FOUND: apps/api/tests/unit/preflight-script-shape.test.ts
- FOUND: apps/api/tests/snapshots/extract-request.snap.ts
- FOUND: apps/api/tests/snapshots/calc-price.snap.ts
- FOUND: apps/api/tests/snapshots/__snapshots__/.gitkeep
- FOUND: apps/api/tests/integration/notif-fsm-transitions.test.ts
- FOUND: apps/api/tests/integration/simulate-call.test.ts
- FOUND: apps/web/tests/unit/format-date-locale.test.ts
- FOUND: apps/web/tests/unit/voice-fallback-asset.test.ts
- FOUND: apps/api/tests/PHASE-5.md

### Commits exist

- FOUND: 52f8cdf (Task 1)
- FOUND: 505619c (Task 2)

### Invariants

- phase-5-stubs.test.ts pending marker count: 11 (exact)
- Each scaffold file pending marker count: 1 (×12 scaffolds)
- Phase 1-4 production diff: empty (git diff --stat HEAD apps/api/src/ apps/web/src/ packages/shared-types/src/ = 0 lines)
- apps/api unit suite: 200 passed | 17 todo (was 200/0 — +11 stubs + 6 unit/snapshot scaffolds)
- apps/web suite: 28 passed | 2 todo (was 28/0 — +2 web scaffolds)

---
*Phase: 05-demo-polish-notifications-final-i18n*
*Completed: 2026-06-11*
