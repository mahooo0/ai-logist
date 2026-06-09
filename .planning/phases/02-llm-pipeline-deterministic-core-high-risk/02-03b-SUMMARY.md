---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 03b
subsystem: tests/unit (phase-2-stubs)
tags: [todo-flip, atomic-commit, wave-2-merge, requirements-traceability]
requires:
  - 02-02 (extractRequest, nearestTruck, calcPrice tools)
  - 02-03 (LEAD_TRANSITIONS, ORDER_TRANSITIONS, VersionMismatch)
  - 02-01 (leadEventsRepo barrel re-export)
provides:
  - 9 real it() assertions in phase-2-stubs.test.ts covering LOGIC-01/05, MATCH-01/03/05, FSM-01/02/03/05
  - Single atomic commit so future plans can grep for FLIPPED markers per requirement
affects:
  - Wave 3 (Plan 02-04a) — flips LOGIC-03
  - Wave 3 (Plan 02-04b) — flips LOGIC-04, FSM-04, FSM-06
  - Wave 4 (Plan 02-05)  — flips API-07
tech-stack:
  added: []
  patterns:
    - Atomic single-file commit for race-prone shared test surfaces
    - Sanity-grep assertions (readFile + regex) for SQL-in-code requirements that have
      a deeper proof in a Docker-gated integration test
    - Reference-assertion pattern — unit test checks the exported class/table shape, with
      a comment pointing at the integration file that closes the full requirement
key-files:
  created:
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03b-SUMMARY.md
  modified:
    - apps/api/tests/unit/phase-2-stubs.test.ts (14 todo → 5 todo; +9 it() blocks; +6 imports)
decisions:
  - "Used readFile('src/pipeline/llm-tools/nearest-truck.ts') with anchored regex for MATCH-01 instead of importing the function — the actual PostGIS index-scan proof is Docker-gated and lives in tests/integration/nearest-truck-knn.test.ts. The unit test now reliably catches accidental deletion/rewrite of the CTE re-rank SQL without spinning up testcontainers."
  - "Adjusted MATCH-01 regex from /ORDER BY.*geom.*<->/ (single-line) to /ORDER BY[\\s\\S]*geom[\\s\\S]*<->/ (multi-line) — the actual nearest-truck.ts SQL template puts ORDER BY on a separate line from geom. Pure plan-fidelity bug; the intent is identical."
  - "Adjusted MATCH-01 third regex from /WHERE.*status = 'available'/ to /status = 'available'/ — same multi-line issue. The 'WHERE' line and the 'status =' line are on separate template lines in nearest-truck.ts."
  - "Rewrote the file's header comment block to avoid the literal token 'test.todo' inside narrative prose — the plan's automated verify uses `grep -c 'test.todo'` which is a literal byte-string count, so any prose mention of `test.todo` inflates the count and breaks the gate. Replaced with 'test + . + todo literal call-sites' phrasing. Functionally identical, grep-safe."
  - "FSM-03 and FSM-05 unit assertions are explicit 'reference' tests (class export + repo function exports) with comments pointing at the integration tests that close the full requirement. This matches the plan's intent — Plan 02-03 Task 3 already shipped Docker-gated 100×-iteration and audit-log integration tests; duplicating those in the unit suite would slow CI without adding coverage."
metrics:
  duration: ~5min
  tasks_completed: 1/1
  files_created: 0
  files_modified: 1
  tests_added: 9 (real it() blocks; replaces 9 test.todo placeholders)
  date: 2026-06-09
---

# Phase 2 Plan 03b: Atomic Stub Flips Summary

One-liner: Atomic single-commit flip of 9 phase-2-stubs.test.ts test.todo markers into real it() assertions for LOGIC-01/05, MATCH-01/03/05, FSM-01/02/03/05 — closes Wave 2 BLOCKER #2 (parallel-write race on shared test file).

## What Was Built

A single targeted modification to `apps/api/tests/unit/phase-2-stubs.test.ts`:

- 6 new imports (alphabetized by biome): `calcPrice`, `ExtractRequestSchema`, `LEAD_TRANSITIONS`, `ORDER_TRANSITIONS`, `VersionMismatch`, `leadEventsRepo`, plus `node:fs/promises` for the MATCH-01 source grep.
- 9 `test.todo()` placeholders replaced with real `it()` blocks (in file order: LOGIC-01, LOGIC-05, MATCH-01, MATCH-03, MATCH-05, FSM-01, FSM-02, FSM-03, FSM-05).
- Updated the file-header counting-protocol comment to reflect the new post-flip state (5 todo remain) and to keep the literal `test.todo` byte-string off of any narrative prose lines (the grep verifier counts byte-literal occurrences — see Deviation 4 below).

## Commit

- `d383a85` `test(02-03b): flip 9 phase-2-stubs todos to it() (atomic, post-Wave-2 merge)`

## Verification Results

| Gate                                                                        | Result                            |
| --------------------------------------------------------------------------- | --------------------------------- |
| `pnpm --filter @ai-logist/api typecheck`                                    | exit 0                            |
| `pnpm exec biome check apps/api/tests/unit/phase-2-stubs.test.ts`           | clean (no fixes, no errors)       |
| `pnpm exec vitest run --project unit tests/unit/phase-2-stubs.test.ts`      | **13 passed | 5 todo (18 total)** |
| `pnpm --filter @ai-logist/api test:unit` (whole unit project)               | **143 passed | 5 todo (148 total)** |
| `grep -c "test.todo" apps/api/tests/unit/phase-2-stubs.test.ts`             | **5** (exactly as required)       |
| `grep -q "LOGIC-01: extractRequest parses" ...`                             | PASS                              |
| `grep -q "FSM-01: LEAD_TRANSITIONS" ...`                                    | PASS                              |
| `grep -q "FSM-02: ORDER_TRANSITIONS" ...`                                   | PASS                              |
| `grep -q "MATCH-03: calcPrice deterministic" ...`                           | PASS                              |

## Requirements Closed

This plan flips the unit-test placeholders for the following 9 v1 requirements (per `requirements:` in PLAN frontmatter and `.planning/REQUIREMENTS.md` traceability):

- **LOGIC-01** — extractRequest schema + handler exist and parse canonical D-09 input.
- **LOGIC-05** — `ExtractRequestSchema.strict()` rejects unknown fields (e.g. injection attempts).
- **MATCH-01** — `nearest-truck.ts` source contains the CTE re-rank pattern (`ORDER BY ... geom ... <->`, `ST_Distance(..., true)`, `status = 'available'`).
- **MATCH-03** — `calcPrice` is deterministic across two identical calls (bigint kopecks output stable).
- **MATCH-05** — `calcPrice` returns `{min, default, max}` with min/default ≈ 0.85 and max/default ≈ 1.15 (within roundTo50 tolerance ±0.01).
- **FSM-01** — `LEAD_TRANSITIONS` table has exactly 9 stages; `NEW`→`[QUALIFIED, LOST]`; `DONE`/`LOST` terminal.
- **FSM-02** — `ORDER_TRANSITIONS` table has exactly 7 statuses; `CREATED`→`[DRIVER_ASSIGNED]`; `CLOSED` terminal.
- **FSM-03** — `VersionMismatch` class exported with discriminating `.code = 'version_mismatch'` (sanity reference; 100× concurrency proof in `tests/integration/fsm-concurrency.test.ts`).
- **FSM-05** — `leadEventsRepo` exports `appendEvent` + `listByLead` (sanity reference; per-transition audit-row proof in `tests/integration/fsm-events-audit.test.ts`).

## Remaining test.todo (5)

After this plan: `apps/api/tests/unit/phase-2-stubs.test.ts` contains exactly 5 `test.todo` call-sites, owned by future plans:

| Requirement | Marker                                                              | Owning plan        |
| ----------- | ------------------------------------------------------------------- | ------------------ |
| LOGIC-03    | `cities ILIKE → hit; Nominatim fallback caches result`              | Plan 02-04a        |
| LOGIC-04    | `after 2 empty clarifications, lead stays NEW`                      | Plan 02-04b        |
| FSM-04      | `pg_advisory_xact_lock(hashtext(client_id)) serializes per-client`  | Plan 02-04b        |
| FSM-06      | `lead in QUOTED for >24h → scheduler transitions to LOST`           | Plan 02-04b        |
| API-07      | `POST /api/leads/:id/match and /quote return 200 (not 501)`         | Plan 02-05         |

Total schedule: 4 (Plan 02-01 Wave 1) + 9 (this plan Wave 2 post-merge) + 1 (Plan 02-04a) + 3 (Plan 02-04b) + 1 (Plan 02-05) = 18 ✓.

## Atomic-Commit Pattern (BLOCKER #2 closure)

Plans 02-02 and 02-03 originally both listed `phase-2-stubs.test.ts` as a `files_modified` target — running them in parallel (Wave 2a + Wave 2b) would race on this single file. The phase plan was restructured to:

1. Strip the test-file modification from 02-02 + 02-03 (those plans now ship pure source code; their unit tests live in dedicated files like `tests/unit/calc-price.test.ts`, `tests/unit/lead-fsm.test.ts`).
2. Add this micro-plan (02-03b) AFTER 02-02 + 02-03 merge, with sole ownership of `phase-2-stubs.test.ts` for all 9 Wave-2 flips.

Result: zero shared file writes during Wave 2 parallel execution; this plan is a single-task single-file commit so its own race surface is null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] MATCH-01 regex did not match real nearest-truck.ts SQL layout**
- **Found during:** First test run after pasting the plan-supplied test verbatim.
- **Issue:** Plan supplied `/ORDER BY.*geom.*<->/`, `/ST_Distance.*true/`, `/WHERE.*status = 'available'/` — these are single-line patterns. The actual `nearest-truck.ts` SQL template (shipped by Plan 02-02) places `ORDER BY` on its own line, `geom` on a later line, and `WHERE` two lines above `status = 'available'`. By default, `.` in JavaScript regex does not match newlines.
- **Fix:** Replaced `.*` with `[\s\S]*` for the multi-line patterns, and dropped the leading `WHERE` clause from the status-check regex (kept just `status = 'available'`). Intent (catch a CTE re-rank SQL pattern) is identical; the regex now actually finds it.
- **Files modified:** `apps/api/tests/unit/phase-2-stubs.test.ts`
- **Commit:** `d383a85` (included in the atomic commit)

**2. [Rule 1 — Bug] Header comment broke the `grep -c "test.todo"` counting protocol**
- **Found during:** Running the plan's automated verify block after the first edit pass.
- **Issue:** I had written `\`test.todo\` literals` in narrative prose inside the file's header comment. The plan's verify gate is `test "$(grep -c "test.todo" ...)" = "5"` — a literal byte-string count that does not distinguish call-sites from prose mentions. The prose mention pushed the count to 6, failing the gate.
- **Fix:** Rewrote the comment to break the literal token across the page: `test + . + todo literal call-sites`. Semantically identical; grep-safe.
- **Files modified:** `apps/api/tests/unit/phase-2-stubs.test.ts`
- **Commit:** `d383a85`

### Biome auto-formatting

- Imports were collapsed and re-ordered alphabetically within group (`leadEventsRepo` → `VersionMismatch` → `LEAD_TRANSITIONS` → `ORDER_TRANSITIONS` → `calcPrice` → `ExtractRequestSchema` in dependency-path order). `biome check --write` did this on first run; subsequent runs are clean.
- The plan's literal import block in `<action>` listed the imports in a slightly different order; biome's `useSortedAttributes`-style import sort is authoritative.

### Authentication gates

None encountered — no external services touched.

### Architectural decisions

None. All flips matched the plan's spec exactly except for the two regex/comment bugs documented above.

## Known Stubs

None. Every flipped `it()` block is a real test that runs and asserts. The two reference-pattern assertions (FSM-03, FSM-05) are intentional sanity references with comments pointing at the integration tests that close the full requirement — this is not stubbing, it is layered coverage.

## Next

- **Plan 02-04a** (Wave 3 intake first half) — flips LOGIC-03 (city normalization via Nominatim + cities table).
- **Plan 02-04b** (Wave 3 intake second half) — flips LOGIC-04 (clarification budget), FSM-04 (`pg_advisory_xact_lock`), FSM-06 (auto-follow-up scheduler).
- **Plan 02-05** (Wave 4 routes) — flips API-07 (`POST /api/leads/:id/match`, `/quote` return 200).

## Self-Check: PASSED

- `apps/api/tests/unit/phase-2-stubs.test.ts` — MODIFIED (1 file, +141 / -26 lines)
- Commit `d383a85` — FOUND in `git log --oneline -5`
- `grep -c "test.todo"` = 5 — VERIFIED
- 13 it() blocks pass + 5 todo remain — VERIFIED via `pnpm exec vitest run --project unit tests/unit/phase-2-stubs.test.ts`
- Whole unit project (148 tests) still green — VERIFIED via `pnpm test:unit`
- tsc + biome both clean — VERIFIED
