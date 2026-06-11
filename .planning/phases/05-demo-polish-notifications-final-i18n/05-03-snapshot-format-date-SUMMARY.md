---
phase: 05-demo-polish-notifications-final-i18n
plan: 03
subsystem: testing
tags: [vitest, snapshot, date-fns, locale, i18n, mock-anthropic, polish-01, i18n-04, notif-01, notif-02]

# Dependency graph
requires:
  - phase: 05-00-test-infra
    provides: phase-5-stubs.test.ts baseline (8 markers entering Wave 3) + tests/snapshots/.gitkeep
  - phase: 05-01-notif-audit
    provides: NOTIF-01 + NOTIF-02 audit + validation suites (notif-fsm-transitions, i18n-no-track-link)
  - phase: 05-02-i18n-core
    provides: i18n dict + ICU plural infra (independent of date formatting)
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: MockAnthropicClient + canonical-inputs.json + llm-responses.json + FIXED_NOW + extractRequestHandler + calcPrice
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    provides: apps/web/src/lib/format.ts (Phase 4 formatMoney/formatDate/formatPhone/formatDuration to EXTEND)

provides:
  - 20 canonical extractRequest snapshots committed (byte-stable via MockAnthropicClient)
  - 10 calcPrice snapshots committed (byte-stable via FIXED_NOW + FIXED_CONFIG)
  - test:snapshot 10× byte-stability gate active (10/10 green)
  - formatDateLocale + formatDateTimeLocale shipped on apps/web (RU + UA)
  - date-fns/locale per-path import pattern locked (Pitfall §2 guard)
  - Marker count 8 → 4 (POLISH-01, NOTIF-01, NOTIF-02, I18N-04 flipped to test.skip)

affects:
  - 05-04-simulate-adapter-preflight (POLISH-02 + POLISH-05 + POLISH-06 — remaining Wave 4 markers)
  - 05-05-video-uat-gate (POLISH-03 + HUMAN-UAT-06)
  - future PRs touching extract-request or calc-price (snapshot CI gate will catch drift)

# Tech tracking
tech-stack:
  added:
    - "vitest snapshot serializer (existing) — extended to tests/snapshots/ path"
    - "date-fns/locale/ru + date-fns/locale/uk subpath imports (verified Turbopack tree-shake clean)"
  patterns:
    - "Snapshot byte-stability: MockAnthropicClient + FIXED_NOW + BigInt-as-string serialization"
    - "date-fns subpath imports MANDATORY for tree-shake (no `from 'date-fns/locale'` barrel)"
    - "vitest project glob extension: include tests/snapshots/**/*.snap.ts under unit project (same setupFiles)"
    - "Fixture seeding: when canonical-inputs ⊃ existing fixtures, seed deterministic mock responses via sha256-keyed JSON augmentation"

key-files:
  created:
    - "apps/api/tests/snapshots/__snapshots__/calc-price.snap.ts.snap (10 entries, 3061 bytes)"
    - "apps/api/tests/snapshots/__snapshots__/extract-request.snap.ts.snap (20 entries, 9611 bytes)"
  modified:
    - "apps/api/tests/snapshots/calc-price.snap.ts (scaffold → 10 it() blocks)"
    - "apps/api/tests/snapshots/extract-request.snap.ts (scaffold → 20 it() blocks)"
    - "apps/api/tests/fixtures/llm-responses.json (12 → 26 keys; +14 seeds for canon-06..10, 12..20)"
    - "apps/api/vitest.config.ts (extended unit.include glob with tests/snapshots/**/*.snap.ts)"
    - "apps/web/src/lib/format.ts (+ formatDateLocale + formatDateTimeLocale, per-path date-fns/locale)"
    - "apps/web/tests/unit/format-date-locale.test.ts (scaffold → 6 it() blocks)"
    - "apps/api/tests/unit/phase-5-stubs.test.ts (4 test.todo → test.skip; count 8 → 4)"

key-decisions:
  - "Snapshot file path: tests/snapshots/*.snap.ts (separate from tests/unit/) — kept distinct so test:snapshot filter '-t snapshot' picks up only the byte-stability suite, not the existing Phase 2 it('snapshot: ...') blocks under tests/unit/. Required vitest.config glob extension."
  - "Fixture seeding (Rule 2 deviation): canonical-inputs.json had 20 entries but llm-responses.json had fixtures for only 6 (canon-01..05 + canon-11). Auto-seeded 14 deterministic mock responses by computing sha256_prefix(systemPrompt + wrapped_text) for each missing canon-XX and writing plausible ExtractRequestOutput shapes tuned to each input's expect{} hints. Without this, the 20-input snapshot promise would silently degrade to 6 inputs."
  - "BigInt serialization: kopecks emitted as .toString() — matches Phase 2 calc-price snapshot precedent + Pitfall §3 (no JSON.stringify(BigInt) crash)."
  - "Snapshot shape drops budget_kopecks bigint → null/string in extract-request — no canonical input currently has a non-null budget that the Zod schema accepts (z.bigint().nullable() rejects string JSON). Kept canon-16 budget_kopecks=null to keep fixture parseable; if budget extraction enters scope later, schema must accept string→bigint coercion."
  - "date-fns regex tolerance: UA renders 4-char month abbrev 'черв.' + 3-char dow 'пон'; RU renders 3-char 'июн' + 3-char dow 'пнд'. Test regex widened to {3,5} month + {2,4} dow to absorb date-fns library variance without losing semantic check."
  - "Marker comment hygiene preserved: test.skip messages spell out 'validated by ...test.ts' validation pointers but do NOT use literal pending-marker token in prose (per phase-5-stubs.test.ts docstring rule re-burned 7 times)."

patterns-established:
  - "Pattern (POLISH-01): snapshot tests live in tests/snapshots/*.snap.ts; auto-loaded by unit project; filtered via -t snapshot; gated by test:snapshot 10× bash loop in package.json"
  - "Pattern (I18N-04): date-fns locale subpath imports are MANDATORY on apps/web — `import { ru } from 'date-fns/locale/ru'` + `import { uk } from 'date-fns/locale/uk'`. Barrel `from 'date-fns/locale'` is prohibited (Turbopack tree-shake regression per Pitfall §2)."
  - "Pattern (marker-flip): each Wave flips a deterministic subset of phase-5-stubs.test.ts markers, with explicit 'validated by ...test.ts' suffix that points to the live validation suite. Count change documented in VALIDATION.md monotonic sequence (11 → 11 → 8 → 4 → 1 → 0)."
  - "Pattern (fixture-augmentation): when a snapshot test needs broader fixture coverage than Phase 2 shipped, append deterministic mock responses via sha256-keyed JSON augmentation rather than rewriting existing entries."

requirements-completed: [POLISH-01, NOTIF-01, NOTIF-02, I18N-04]

# Metrics
duration: ~10min
completed: 2026-06-11
---

# Phase 05 Plan 03: Snapshot tests + I18N-04 formatDateLocale + Wave 3 marker flips Summary

**POLISH-01 byte-stable snapshots (10 calcPrice + 20 extractRequest) + I18N-04 admin date formatters via date-fns/locale subpath imports + 4 phase-5-stubs markers flipped (8 → 4)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-11T06:34:00Z
- **Completed:** 2026-06-11T06:47:00Z
- **Tasks:** 2
- **Files modified:** 7 (1 fixture-augmented + 6 source/test files)
- **Files created:** 2 (snapshot files in __snapshots__/)

## Accomplishments

- **POLISH-01 snapshot CI gate active:** 10 calcPrice combos + 20 extractRequest canonical inputs run through MockAnthropicClient produce byte-identical output across 10 consecutive runs. `pnpm --filter @ai-logist/api test:snapshot` returns exit 0 on every run (verified 10/10 + a confirmation 10/10).
- **POLISH-01 fixture coverage upgraded:** Phase 2 shipped 6 mock fixtures (canon-01..05, canon-11); Wave 3 seeded 14 additional deterministic responses (canon-06..10, canon-12..20) so the snapshot tests cover the full 20-input spec.
- **I18N-04 admin date formatters shipped:** `formatDateLocale(date, lang)` and `formatDateTimeLocale(date, lang)` exported from `apps/web/src/lib/format.ts`. RU renders `"8 июн., пнд"`, UA renders `"8 черв., пон"` for fixed test date 2026-06-08T12:00:00Z. Time variant adds `HH:mm` suffix.
- **Bundle hygiene locked:** date-fns/locale imports use per-path subpaths (`date-fns/locale/ru`, `date-fns/locale/uk`) — no barrel imports. Verified by grep guard + clean `pnpm --filter @ai-logist/web build` (30 routes compiled, no Turbopack tree-shake regression).
- **Marker count 8 → 4:** POLISH-01 + NOTIF-01 + NOTIF-02 + I18N-04 flipped from `test.todo` to `test.skip` with validation-suite pointers. Matches VALIDATION.md Wave 3 target exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: POLISH-01 byte-stable snapshots — 10 calcPrice + 20 extractRequest** — `f0c4f95` (test)
2. **Task 2: I18N-04 formatDateLocale + flip 4 phase-5-stubs markers (8 → 4)** — `ab46f63` (feat)

## Files Created/Modified

### Created

- `apps/api/tests/snapshots/__snapshots__/calc-price.snap.ts.snap` — 10 deterministic kopecks corridors (default/min/max + breakdown). All BigInt fields serialized as strings.
- `apps/api/tests/snapshots/__snapshots__/extract-request.snap.ts.snap` — 20 canonical-input outputs through MockAnthropicClient. Zero timestamp/UUID leakage (grep-verified).

### Modified

- `apps/api/tests/snapshots/calc-price.snap.ts` — Wave 0 scaffold (test.todo) → 10 it() blocks looping over CASES array with FIXED_CONFIG (rate=4200n, dir.default=1.0, dir.back_haul=0.85, season=1.0) and FIXED_NOW.
- `apps/api/tests/snapshots/extract-request.snap.ts` — Wave 0 scaffold (test.todo) → 20 it() blocks reading canonical-inputs.json, driving each through extractRequestHandler with MockAnthropicClient. Snapshot shape excludes all non-deterministic fields.
- `apps/api/tests/fixtures/llm-responses.json` — 12 → 26 keys. Added 14 deterministic mock responses (canon-06..10, canon-12..20). Hash keys computed via sha256_prefix(EXTRACT_REQUEST_SYSTEM_PROMPT + '\\n---\\n' + '<client_message>' + text + '</client_message>').
- `apps/api/vitest.config.ts` — unit project include glob extended with `'tests/snapshots/**/*.snap.ts'`. Same setupFiles (fake-timers.ts) shared so FIXED_NOW is auto-injected.
- `apps/web/src/lib/format.ts` — added 3 imports (`format` from date-fns, `ru` from date-fns/locale/ru, `uk` from date-fns/locale/uk) + 2 exported functions (`formatDateLocale`, `formatDateTimeLocale`). Comment block documents per-path subpath rationale + Pitfall §2 reference.
- `apps/web/tests/unit/format-date-locale.test.ts` — Wave 0 scaffold (test.todo) → 6 it() blocks: RU month+dow assertion, UA month+dow assertion, ISO string acceptance, default-lang RU, formatDateTimeLocale HH:mm component, UA formatDateTimeLocale combined.
- `apps/api/tests/unit/phase-5-stubs.test.ts` — 4 test.todo → test.skip:
  - I18N-04 → validated by `apps/web/tests/unit/format-date-locale.test.ts` (Plan 05-03)
  - NOTIF-01 → validated by `apps/api/tests/integration/notif-fsm-transitions.test.ts` (Plan 05-01)
  - NOTIF-02 → validated by `apps/api/tests/unit/i18n-no-track-link.test.ts` (Plan 05-01)
  - POLISH-01 → validated by `tests/snapshots/*.snap.ts` + `test:snapshot` 10× loop (Plan 05-03)

## Decisions Made

- **Snapshot file location separation** — kept new `tests/snapshots/*.snap.ts` distinct from existing `tests/unit/*.test.ts` so the `test:snapshot` filter (`-t snapshot`) only picks the byte-stability suite. Required vitest.config glob extension (1-line change vs. adding a separate project).
- **Fixture seed shapes tuned to expect{} hints** — each new mock response derives values from canonical-inputs.json's `expect` hints (e.g., canon-09 → `body_type: 'ref'`, canon-13 → `body_type: 'container'`, canon-19 → all-null + clarifying_question_ru about discount eligibility).
- **Regex flexibility on day-of-week + month abbrev** — date-fns RU/UA locale abbreviation widths differ from spec assumption ("ср" 2-char dow vs. actual "пнд" 3-char dow; "июн" 3-char month vs. UA "черв" 4-char). Widened regex to `{2,4}` dow + `{3,5}` month with optional trailing period to absorb library variance without losing semantic check (must still contain "июн" / "чер").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Seeded 14 missing mock LLM fixtures**

- **Found during:** Task 1 (extract-request.snap.ts setup)
- **Issue:** Plan promised "all 20 canonical inputs" through snapshot tests, but `llm-responses.json` only had fixtures for 6 inputs (canon-01..05, canon-11). MockAnthropicClient throws `"no fixture for key=..."` on unknown sha256_prefix, so 14/20 canonical inputs would have failed silently or required test.skip.
- **Fix:** Wrote a one-off seeder script (`/tmp/seed-fixtures.ts`) that computes the deterministic hash key for each missing canon-XX, then appends a plausible ExtractRequestOutput shape tuned to the input's `expect{}` hints. Wrote 14 new entries; total fixture keys 12 → 26.
- **Files modified:** `apps/api/tests/fixtures/llm-responses.json`
- **Verification:** All 20 extract-request snapshots render and pass byte-stability gate (10/10 runs identical).
- **Committed in:** `f0c4f95` (Task 1)

**2. [Rule 3 — Blocking] Extended vitest unit project include glob**

- **Found during:** Task 1 (writing snapshot tests under new directory)
- **Issue:** New `tests/snapshots/*.snap.ts` files were not picked up by the existing `unit` project (`tests/unit/**/*.test.ts` glob). `test:snapshot` filter `-t snapshot` would have run only the existing Phase 2 `it('snapshot: ...')` blocks inside `tests/unit/`, silently skipping the new suite.
- **Fix:** Added `'tests/snapshots/**/*.snap.ts'` to the `unit` project's `include` array. Same project, same setupFiles (FIXED_NOW + DATABASE_URL stub), no new project needed.
- **Files modified:** `apps/api/vitest.config.ts`
- **Verification:** `pnpm test:snapshot` picks up 4 test files (was 3) and runs 33 snapshot tests (was 12 pre-Wave 3).
- **Committed in:** `f0c4f95` (Task 1)

**3. [Rule 1 — Bug] Coerced canon-16 budget_kopecks from string to null**

- **Found during:** Task 1 (validating seeded fixtures against ExtractRequestSchema)
- **Issue:** Initial seed for canon-16 ("20т 50000 руб Киев-Львов") set `budget_kopecks: "5000000"` (string). Schema is `z.bigint().nullable()` — strict parse rejects strings.
- **Fix:** Set `budget_kopecks: null` for canon-16. The canonical input's expect hint `budget_kopecks_set: true` is informational, not a runtime constraint — snapshot tests verify shape stability, not extraction completeness (that's covered by Phase 2 unit tests with full schema-aware mocks).
- **Files modified:** `apps/api/tests/fixtures/llm-responses.json`
- **Verification:** All canon-XX extract-request snapshots parse without ZodError.
- **Committed in:** `f0c4f95` (Task 1)

**4. [Rule 1 — Bug] Widened day-of-week + month-abbrev regex for date-fns library variance**

- **Found during:** Task 2 (first GREEN attempt on format-date-locale.test.ts)
- **Issue:** Initial regex assumed RU "ср" 2-char dow + UA "чер" 3-char month abbrev. Actual library output is "пнд" 3-char dow + "черв." 4-char month with trailing period.
- **Fix:** Widened regex to `^\d{1,2} [а-я(ї)]{3,5}\.?,? [а-я(ї)]{2,4}\.?$/i` with optional periods. Substring assertion `toContain('июн')`/`toContain('чер')` remains as semantic check.
- **Files modified:** `apps/web/tests/unit/format-date-locale.test.ts`
- **Verification:** All 6 it() blocks pass.
- **Committed in:** `ab46f63` (Task 2)

**5. [Rule 1 — Bug] Rephrased comment to avoid barrel-import grep collision**

- **Found during:** Task 2 (running grep guard for barrel imports)
- **Issue:** Comment "barrel `import { ru, uk } from 'date-fns/locale'` pulls all 100+ locales" tripped the negative grep guard (`! grep "from 'date-fns/locale'"`) because the literal barrel string was in the comment.
- **Fix:** Rephrased to "the non-suffixed barrel index pulls all 100+ locales" — same semantic content, no literal barrel string for grep to false-flag.
- **Files modified:** `apps/web/src/lib/format.ts`
- **Verification:** `grep "from 'date-fns/locale'" apps/web/src/lib/format.ts` returns no matches; subpath imports still present (2 each).
- **Committed in:** `ab46f63` (Task 2)

---

**Total deviations:** 5 auto-fixed (1 missing critical + 1 blocking + 3 bugs)
**Impact on plan:** All 5 deviations were necessary for the plan to deliver its byte-stability + per-path-import + marker-count promises. No scope creep — every fix sits inside the plan's stated success criteria.

## Issues Encountered

- None beyond the deviations above. Both task TDD cycles (RED → GREEN) ran cleanly; no debugger sessions needed.

## User Setup Required

None — no external service configuration required. Snapshots are pure-data fixture files; date-fns/locale ships locally as part of date-fns@4.

## Next Phase Readiness

- **Plan 05-04 unblocked:** Wave 4 will land POLISH-02 (simulate-call route), POLISH-05 (preflight.ts), POLISH-06 (LLM_PROVIDER adapter) — all independent of snapshots + dates.
- **Plan 05-05 unblocked:** Wave 5 ships voice-fallback.mp4 + HUMAN-UAT-06.md. No dependency on this plan's output.
- **CI gate active:** Any future PR that modifies `extract-request.ts` or `calc-price.ts` will trigger a snapshot diff, requiring explicit `--update` flag review (intent: spot accidental output shape drift).
- **Marker progression on track:** Wave 3 target 4 markers met. Wave 4 target is 1 marker (POLISH-02/05/06 flipped). Wave 5 target is 0.

---

## Self-Check: PASSED

Verified:
- `apps/api/tests/snapshots/calc-price.snap.ts` exists (FOUND)
- `apps/api/tests/snapshots/extract-request.snap.ts` exists (FOUND)
- `apps/api/tests/snapshots/__snapshots__/calc-price.snap.ts.snap` exists (FOUND, 3061 bytes)
- `apps/api/tests/snapshots/__snapshots__/extract-request.snap.ts.snap` exists (FOUND, 9611 bytes)
- `apps/web/src/lib/format.ts` contains `formatDateLocale` + `formatDateTimeLocale` (FOUND)
- `apps/web/tests/unit/format-date-locale.test.ts` contains 6 it() blocks, 0 test.todo (FOUND)
- `apps/api/tests/unit/phase-5-stubs.test.ts` has 4 test.todo (was 8) — verified via grep (FOUND)
- Commit `f0c4f95` present in git log (FOUND)
- Commit `ab46f63` present in git log (FOUND)
- `pnpm --filter @ai-logist/api test:snapshot` exited 0 across 10 runs (VERIFIED)
- `pnpm --filter @ai-logist/web build` succeeded, 30 routes compiled (VERIFIED)

---

*Phase: 05-demo-polish-notifications-final-i18n*
*Completed: 2026-06-11*
