---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 00
subsystem: testing

tags:
  - vitest
  - testcontainers
  - anthropic-sdk
  - mock-llm
  - fake-timers
  - snapshot-stability
  - fixtures

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: vitest 4.1.x + testcontainers 12 wiring, apps/api/src/db.ts createDb factory, tests/_helpers/test-db.ts PostGIS container helper, drizzle-orm sql template, FIXED_NOW convention from Plan 01-10 smoke gate
provides:
  - LlmProvider interface (Wave 1 production llm-client.ts MUST implement)
  - MockAnthropicClient keyed by sha256(systemPrompt + lastUser).slice(0,16)
  - runScript(db, llm, clientId, messages) dialog harness (no Fastify boot, no webhook)
  - FIXED_NOW = 2026-06-09T12:00:00Z fake-timers preset for unit project
  - DETERMINISTIC_UUIDS (20 RFC 4122 v4 UUIDs) + nextUuid() + installDeterministicCrypto()
  - canonical-inputs.json (20 scripts canon-01..canon-20)
  - cities-extra.json (5 cities forcing Nominatim path)
  - injection-attempts.json (5 Pitfall #11 corpus)
  - phase-2-stubs.test.ts (18 test.todo markers, one per Phase 2 req)
  - test:llm + test:snapshot + typecheck npm scripts
affects: 02-01-migration-lib-llm-client, 02-02-llm-tools, 02-03-fsm, 02-03b-stub-flips, 02-04a-pipeline-intake-first-half, 02-04b-pipeline-intake-second-half, 02-05-routes-api

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LlmProvider interface DI: tests inject MockAnthropicClient; Wave 1 production llm-client.ts implements the same shape so handlers are clock/network-isolated."
    - "Deterministic key derivation for LLM fixtures: sha256(systemPrompt + '\\n---\\n' + lastUser).slice(0,16). Mock + production hash with identical input."
    - "Unit-project setupFiles: shared vi.useFakeTimers preset eliminates per-test setup boilerplate. Integration project skips it (testcontainers needs real Date)."
    - "Deterministic UUID injection via installDeterministicCrypto monkey-patch with explicit teardown closure — pattern reusable across snapshot tests."
    - "Dynamic import of forward-referenced production modules + @ts-expect-error directive lets Wave 0 ship without Wave 3 files."

key-files:
  created:
    - apps/api/tests/_helpers/dialog-harness.ts
    - apps/api/tests/_helpers/mock-anthropic.ts
    - apps/api/tests/_helpers/fake-timers.ts
    - apps/api/tests/_helpers/db-seed.ts
    - apps/api/tests/fixtures/canonical-inputs.json
    - apps/api/tests/fixtures/llm-responses.json
    - apps/api/tests/fixtures/cities-extra.json
    - apps/api/tests/fixtures/injection-attempts.json
    - apps/api/tests/unit/phase-2-stubs.test.ts
    - apps/api/tests/PHASE-2.md
  modified:
    - apps/api/vitest.config.ts
    - apps/api/package.json

key-decisions:
  - "LlmProvider returns { toolCalls[], finalText, usage{ input_tokens, output_tokens } } — Wave 1 production wrapper around client.beta.messages.toolRunner MUST flatten the SDK's response into this shape so handlers see one stable contract."
  - "FIXED_NOW pinned at 2026-06-09T12:00:00Z (project time) rather than UTC midnight or 10:00Z (RESEARCH.md §11 example) — 12:00Z keeps business-hours math (RU/UA workday) intact in snapshot scenarios that touch deadline_iso."
  - "fake-timers setupFile registered on unit project only — integration project (testcontainers PostGIS) MUST NOT freeze Date because Postgres NOW() and JS Date.now() would drift and produce ambiguous FOR UPDATE / version mismatch failures."
  - "DETERMINISTIC_UUIDS carries exactly 20 entries (matches canonical-inputs.json count). Tests needing >20 UUIDs throw on nextUuid() — forces test authors to think about scope rather than silently wrap around."
  - "phase-2-stubs.test.ts comment hygiene rule: NO literal `test.todo` mentions in docstrings — verifier greps with `grep -c 'test.todo'` and a naive count must hit 18. Phase 1 Plan 01-10 burned this lesson; encoded here."
  - "llm-responses.json starts as `{}` — Wave 2 plans append entries as snapshot tests are flipped from todo to real. Mock throws a maintenance-friendly error including the missing key so seed lookups are self-documenting."
  - "Dynamic import + @ts-expect-error pattern from Phase 1 Plan 01-01 reused: dialog-harness.ts imports src/pipeline/intake.js dynamically with directive. Wave 3 plan 02-04a/b MUST remove the directive once intake.ts lands (anti-pattern caught — see Phase 1 Plan 01-03 SUMMARY)."

patterns-established:
  - "LlmProvider interface contract: shared by test mock + production adapter (Wave 1). Anthropic SDK's BetaMessageParam, toolRunner result envelope, and usage shape are flattened into the LlmProvider return type so handlers are SDK-version-agnostic."
  - "Wave 0 forward-reference handling: dynamic import + @ts-expect-error directive on the import call lets a Wave 0 helper compile even though Wave 3 ships the imported module. Wave 3 plan removes the directive (same convention as Phase 1 Plan 01-01 → 01-03)."
  - "Snapshot stability beforeEach contract: resetDeterministicUuids() + installDeterministicCrypto() pair, exposed as a single import block in PHASE-2.md so Wave 1-4 authors copy-paste instead of re-inventing."
  - "Mock-fixture maintenance UX: MockAnthropicClient.runTurn throws an error string that contains the exact missing key + toolNames + first 80 chars of lastUser — the error message IS the fix-it instruction for the test author."

requirements-completed: []
# Wave 0 plan ANCHORS to all 18 Phase 2 requirements (via test.todo markers, one per req)
# but does NOT fulfill any of them. Each requirement is completed by the wave that ships
# the production code:
#   Wave 1 (02-01): MATCH-03, MATCH-04, MATCH-05, LOGIC-02 (lib primitives)
#   Wave 2 (02-02): LOGIC-01, LOGIC-03, LOGIC-05, MATCH-01, MATCH-02
#   Wave 2 (02-03): FSM-01, FSM-02
#   Wave 3 (02-03b stub-flips): partial flip of remaining todos to real assertions
#   Wave 3 (02-04a/b): LOGIC-04, MATCH-06, FSM-03, FSM-04, FSM-05, FSM-06
#   Wave 4 (02-05): API-07
# Keeping requirements-completed: [] here preserves accurate phase progress tracking in
# REQUIREMENTS.md — premature marking would lie about deliverable state.

# Metrics
duration: 6min
completed: 2026-06-09
---

# Phase 02 Plan 00: Test Infrastructure Summary

**Wave 0 test harness shipped: LlmProvider interface (Wave 1 contract), MockAnthropicClient with deterministic sha256 fixture keying, runScript dialog harness with dynamic-import forward reference, 20-input canonical fixture, 5-input prompt-injection corpus, 18 test.todo markers covering every Phase 2 requirement, and unit-only fake-timers/UUID determinism wiring.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-09T08:43:08Z
- **Completed:** 2026-06-09T08:49:00Z (approx)
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- **LlmProvider interface contract** finalized — Wave 1 production llm-client.ts MUST implement `runTurn({ systemPrompt, userMessages, toolNames }) → { toolCalls, finalText, usage }`. Same shape used by test mock.
- **runScript test harness** drives scripted dialogs end-to-end through `pipeline/intake.ts#handleInboundMessage` without booting Fastify or hitting any webhook — Wave 3 (intake.ts) loads via dynamic import + @ts-expect-error so Wave 0 compiles forward.
- **Snapshot stability infrastructure** wired: `fake-timers.ts` setupFile pins `Date.now()` to `FIXED_NOW = 2026-06-09T12:00:00Z` on every unit test; `db-seed.ts` injects 20 deterministic v4 UUIDs via `crypto.randomUUID` monkey-patch with explicit teardown closure.
- **18 `test.todo()` markers** in `tests/unit/phase-2-stubs.test.ts` — exactly one per Phase 2 requirement (LOGIC-01..05, MATCH-01..06, FSM-01..06, API-07). Each carries a 1-line description Waves 1-4 progressively flip to real assertions.
- **Canonical 20-input fixture** (`canonical-inputs.json`) shipped verbatim from RESEARCH §10.5 — RU/UA/EN-translit/ambiguous/vague/surzhyk/prompt-injection variants drive the snapshot-stability suite.
- **Prompt-injection corpus** (`injection-attempts.json`) — 5 entries covering 4 `no_mutation` + 1 `discount_floor_rejected` expected outcomes (Pitfall #11 audit).
- **5 cities NOT in Phase 1 seed** (`cities-extra.json`) — Тула, Полтава, Калининград, Винница, Воронеж — force Nominatim fallback path in LOGIC-03 integration tests.
- **npm script additions:** `test:llm` (gated on ANTHROPIC_API_KEY), `test:snapshot` (--repeat=10), `typecheck` (tsc --noEmit).
- **PHASE-2.md harness usage doc** — runScript invocation, fixture-keying protocol, snapshot stability beforeEach pattern, mocked-vs-real LLM gating, flip-todo-to-real workflow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Land test harness, mock LLM client, fake-timers, deterministic seed** — `c8e83fd` (feat)
2. **Task 2: Land canonical fixtures + phase-2 stub test file + harness docs** — `9f44a4d` (feat)

**Plan metadata:** _to be created in final commit_

## Files Created/Modified

### Created (10)

- `apps/api/tests/_helpers/dialog-harness.ts` — `runScript(db, llm, clientId, messages)` end-to-end dialog driver with dynamic import of pipeline/intake.js (Wave 3 dependency)
- `apps/api/tests/_helpers/mock-anthropic.ts` — `LlmProvider` interface + `MockAnthropicClient` keyed by sha256(system + lastUser).slice(0,16)
- `apps/api/tests/_helpers/fake-timers.ts` — `FIXED_NOW = 2026-06-09T12:00:00Z` preset registered via vitest.config setupFiles
- `apps/api/tests/_helpers/db-seed.ts` — `DETERMINISTIC_UUIDS` (20 RFC 4122 v4 UUIDs) + `nextUuid()` + `installDeterministicCrypto()` teardown helper
- `apps/api/tests/fixtures/canonical-inputs.json` — 20 dialog scripts (canon-01..canon-20)
- `apps/api/tests/fixtures/llm-responses.json` — `{}` placeholder; Wave 2 plans append entries
- `apps/api/tests/fixtures/cities-extra.json` — 5 cities forcing Nominatim path
- `apps/api/tests/fixtures/injection-attempts.json` — 5 prompt-injection corpus entries
- `apps/api/tests/unit/phase-2-stubs.test.ts` — EXACTLY 18 `test.todo()` markers (LOGIC-01..05 + MATCH-01..06 + FSM-01..06 + API-07)
- `apps/api/tests/PHASE-2.md` — harness usage doc (runScript, fixture keying, snapshot stability, flip-todo workflow)

### Modified (2)

- `apps/api/vitest.config.ts` — added `setupFiles: ['./tests/_helpers/fake-timers.ts']` on unit project; bumped integration timeout 60s → 90s for testcontainers cold start
- `apps/api/package.json` — added `test:llm`, `test:snapshot`, `typecheck` scripts

## Decisions Made

See `key-decisions` frontmatter list above. Highlights:

- **LlmProvider shape locked.** Wave 1 production llm-client.ts MUST flatten `client.beta.messages.toolRunner` result into `{ toolCalls[], finalText, usage }` so handlers see one stable contract regardless of SDK changes.
- **fake-timers on unit project only.** Integration project (testcontainers + real PostGIS NOW()) MUST NOT freeze Date — Postgres clock and JS Date.now() would drift and cause non-deterministic FOR UPDATE / version mismatch failures.
- **Comment hygiene rule for grep-counted markers.** Docstrings in `phase-2-stubs.test.ts` use "placeholder marker" instead of "test.todo" so `grep -c 'test.todo'` stays at 18 (Phase 1 Plan 01-10 lesson encoded here).
- **DETERMINISTIC_UUIDS sized at exactly 20.** Tests needing more throw on `nextUuid()`, forcing the author to think about scope rather than silently wrap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created `apps/api/tests/fixtures/llm-responses.json` early as `{}` placeholder**

- **Found during:** Task 1 (mock-anthropic.ts uses `import fixtures from '../fixtures/llm-responses.json' with { type: 'json' }`)
- **Issue:** Plan splits this file into Task 2, but Task 1's mock-anthropic.ts can't `tsc --noEmit` clean without the JSON existing on disk.
- **Fix:** Created `tests/fixtures/llm-responses.json` containing `{}` during Task 1. Task 2 logically owns it but the placeholder is identical to what Task 2 ships.
- **Files modified:** `apps/api/tests/fixtures/llm-responses.json`
- **Verification:** `pnpm exec tsc --noEmit` passes after Task 1.
- **Committed in:** `c8e83fd` (Task 1 commit, listed in the commit message)

**2. [Rule 3 - Blocking] Added `typecheck` script to `apps/api/package.json`**

- **Found during:** Plan verify block (`pnpm --filter @ai-logist/api typecheck`)
- **Issue:** Plan's verify command assumed a `typecheck` script existed; Phase 1 never added one (it was only documented in 02-VALIDATION.md "Auxiliary commands"). The verify command failed with "None of the selected packages has a 'typecheck' script."
- **Fix:** Added `"typecheck": "tsc --noEmit -p tsconfig.json"` to `apps/api/package.json` scripts alongside the `test:llm` + `test:snapshot` additions Task 2 already required.
- **Files modified:** `apps/api/package.json`
- **Verification:** `pnpm --filter @ai-logist/api typecheck` now runs and exits 0.
- **Committed in:** `9f44a4d` (Task 2 commit)

**3. [Rule 1 - Bug] Removed literal "test.todo" mentions from phase-2-stubs.test.ts docstring**

- **Found during:** Task 2 verify block (`test "$(grep -c 'test.todo' tests/unit/phase-2-stubs.test.ts)" = "18"`)
- **Issue:** First draft of the docstring included two lines referencing `test.todo()` for documentation. The naive `grep -c` counted 20 not 18, breaking the acceptance criterion. Same lesson Phase 1 Plan 01-10 hit on `phase-1-stubs.test.ts`.
- **Fix:** Rewrote docstring to use "placeholder marker" instead of "test.todo()" — same intent, no literal substring collision.
- **Files modified:** `apps/api/tests/unit/phase-2-stubs.test.ts`
- **Verification:** `grep -c 'test.todo' tests/unit/phase-2-stubs.test.ts` returns 18.
- **Committed in:** `9f44a4d` (Task 2 commit)

**4. [Rule 3 - Blocking] Removed `as never` cast pattern from RESEARCH §10 dialog-harness**

- **Found during:** Task 1 implementation
- **Issue:** RESEARCH §10's verbatim block uses `db.execute('SQL' as never, [bindings])` which is not how Drizzle 0.45.2's NodePgDatabase.execute works (it takes a `SQL<unknown>` template, not a string + params array — that's the raw `pg.Client.query` API). The pattern won't type-check and won't run.
- **Fix:** Replaced with proper Drizzle `sql\`SELECT … WHERE id = ${lastLeadId}\`` template per the plan's explicit adjustment instruction.
- **Files modified:** `apps/api/tests/_helpers/dialog-harness.ts`
- **Verification:** `pnpm exec tsc --noEmit` passes; `pnpm exec biome check` passes.
- **Committed in:** `c8e83fd` (Task 1 commit, listed in the commit message)

**5. [Rule 1 - Bug] Reverted premature requirements-completed marking in REQUIREMENTS.md**

- **Found during:** state updates after SUMMARY creation
- **Issue:** The plan's frontmatter `requirements:` field lists all 18 Phase 2 reqs (LOGIC/MATCH/FSM/API-07), and the GSD requirements `mark-complete` tool wrote `[x]` against each in REQUIREMENTS.md + flipped 18 rows to "Complete" in the traceability table. This is wrong — Wave 0 only ships `test.todo()` placeholders; the real implementations land in Plans 02-01 through 02-05. Marking complete here would lie about deliverable state and bypass the verifier.
- **Fix:** Ran `git checkout .planning/REQUIREMENTS.md` to revert the premature marks; set the SUMMARY's `requirements-completed` field to `[]` with a comment mapping each req to its actual fulfilling wave. The plan's frontmatter `requirements:` list is the *anchor* (one todo per req in phase-2-stubs.test.ts), not a fulfillment claim.
- **Files modified:** `.planning/REQUIREMENTS.md` (reverted), `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-00-SUMMARY.md` (requirements-completed cleared)
- **Verification:** `grep -A2 "LOGIC-01" .planning/REQUIREMENTS.md` shows `[ ]` and `Pending`.
- **Committed in:** This SUMMARY's metadata commit.

---

**Total deviations:** 5 auto-fixed (3 Rule 3 blocking, 2 Rule 1 bug).
**Impact on plan:** All 4 are required for plan compilability + verifiability. No scope creep — every fix is documented in the plan's explicit adjustment list or stems from Phase 1 lessons already in STATE.md.

## Known Stubs

Wave 0 ships test scaffolding; by design every "stub" listed below is the contract that Waves 1-4 progressively fulfill. None is an unintentional gap.

| Stub                                                                                          | File                                                  | Why intentional                                                                              | Resolved by                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `llm-responses.json` content is `{}`                                                          | `apps/api/tests/fixtures/llm-responses.json`          | Mock LLM keys are seeded only as Waves 2-3 flip todos to real snapshot tests                  | Plans 02-02 + 02-04a/b                   |
| `@ts-expect-error` on `await import('../../src/pipeline/intake.js')` in dialog-harness        | `apps/api/tests/_helpers/dialog-harness.ts`           | `pipeline/intake.ts` ships in Wave 3                                                          | Plan 02-04a/b (must remove the directive) |
| 18 `test.todo()` markers in `phase-2-stubs.test.ts`                                            | `apps/api/tests/unit/phase-2-stubs.test.ts`           | Each marker is the contract Waves 1-4 flip to real `it(...)` blocks                          | Plans 02-01..02-05 progressively         |
| `test:llm` script runs zero tests until a `llm-smoke` describe block is added                  | `apps/api/package.json`                               | Real-LLM smoke ships in Wave 2 once extractRequest exists; until then the filter matches none | Plan 02-02                               |

## Issues Encountered

- **`pnpm exec biome check` from `apps/api` cwd ignored the target paths.** Biome resolves the config relative to the cwd and the `apps/api/...` paths were outside the resolved root. Fix: run biome from the monorepo root (consistent with how the project's other `biome check` invocations work). Documented in the verify block of the SUMMARY — Wave 1-4 plans should use root-relative paths for biome.

## User Setup Required

None — no external service configuration required for Wave 0. Wave 2 (real-LLM smoke) will need `ANTHROPIC_API_KEY` set on the dev machine.

## Next Phase Readiness

Wave 1 (Plan 02-01 — migration + lib primitives + llm-client wrapper) is unblocked. Specifically:

- **Wave 1 (02-01)** can implement `apps/api/src/lib/{money,lang-detect,routing,geocoding,price-guard}.ts` and `apps/api/src/pipeline/llm-client.ts` against the `LlmProvider` interface this plan locked in. Snapshot tests for `calc-price.test.ts` + `lang-detect.test.ts` can flip MATCH-03/04/05 + LOGIC-02 todos.
- **Wave 2 (02-02)** can implement the LLM tool registry + each tool file; fixtures append to `llm-responses.json` keyed by the sha256 protocol this plan documented in PHASE-2.md.
- **Wave 3 (02-04a/b)** can ship `pipeline/intake.ts` and MUST remove the `@ts-expect-error` directive from `dialog-harness.ts` (this plan's known-gap).
- **Wave 4 (02-05)** can flip `/api/leads/:id/{match,quote}` from 501 stubs to real handlers and flip API-07 from todo to a real route-level assertion.

No blockers. Wave 0 success criteria all met (12 files exist, 18 test.todo markers, biome+tsc clean, vitest --project unit shows 18 todo on phase-2-stubs).

---

*Phase: 02-llm-pipeline-deterministic-core-high-risk*
*Completed: 2026-06-09*

## Self-Check: PASSED

- File existence (12/12): all paths in `files_modified` exist on disk.
- Commit hashes verified:
  - `c8e83fd` — Task 1 (test harness + mock LLM + fake-timers + db-seed + vitest config)
  - `9f44a4d` — Task 2 (canonical-inputs + cities-extra + injection-attempts + phase-2-stubs + PHASE-2.md + package.json scripts)
- 18 `test.todo()` markers confirmed via `grep -c`.
- `tsc --noEmit` clean.
- Biome clean on `apps/api/tests/_helpers apps/api/tests/unit apps/api/tests/fixtures`.
- `vitest run --project unit` reports 18 todo across phase-2-stubs.
