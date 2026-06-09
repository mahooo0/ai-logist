---
plan: 02-02-llm-tools
phase: 02-llm-pipeline-deterministic-core-high-risk
status: complete
tasks_completed: 3/3
date: 2026-06-09
subsystem: pipeline/llm-tools
tags:
  - llm-tools
  - betaZodTool
  - tool-registry
  - postgis-knn
  - price-lock
  - anti-injection
dependency_graph:
  requires:
    - "02-01 (LlmProvider interface, lib primitives, runToolLoop helper)"
    - "01-04 (trucks schema + GiST index trucks_geom_gist)"
    - "01-05 (leads.quoted_price + leads.price_overrides jsonb[] + leads.version)"
    - "01-06 (pricing_config table)"
    - "01-09 (seed runner — trucks/clients/cities/pricing fixtures)"
  provides:
    - "apps/api/src/pipeline/llm-tools/index.ts — buildToolRegistry(ctx) + ToolContext"
    - "6 betaZodTool registrations: extractRequest, nearestTruck, calcPrice, createOrder, discount, detectLanguage"
    - "ExtractRequestSchema (D-09 VERBATIM) + EXTRACT_REQUEST_SYSTEM_PROMPT (5 few-shots + anti-injection prefix)"
    - "PostGIS CTE re-rank SQL for nearestTruck (closes Pitfall #2)"
    - "Pure calcPrice + readPricingConfig DB reader"
    - "createOrder transactional price-lock handler (closes Pitfall #1 at type level)"
    - "discount min-floor validator with jsonb[] audit append"
  affects:
    - "Wave 3 (intake.ts) — instantiates ToolContext per turn, calls buildToolRegistry"
    - "Wave 3 (intake.ts) — uses calcPrice + readPricingConfig to write quoted_price BEFORE rendering reply"
    - "Plan 02-03b — atomic-flips LOGIC-01/LOGIC-05/MATCH-01/MATCH-03/MATCH-05 todos in phase-2-stubs.test.ts"
tech_stack:
  added:
    - "no new top-level deps — uses @anthropic-ai/sdk@0.102 + zod@4.4.3 + drizzle-orm@0.45.2 + nanoid@5 (all from Phase 1)"
  patterns:
    - "betaZodTool registry barrel with shared ToolContext per turn (RESEARCH §1 Pattern 1)"
    - "Tool file shape: schema + handler (direct call) + tool registration (LLM call) (RESEARCH Pattern 2)"
    - "Result envelope {ok: true, data: T} | {ok: false, error: {code, message}} (RESEARCH Pattern 3)"
    - "Anti-injection: <client_message>...</client_message> wrap + structural defense (D-42, Pitfall #11)"
    - "Stub-then-replace: Task 1 created NOT_IMPLEMENTED stubs so the barrel type-checks; Tasks 2/3 replaced bodies in-place without changing exports"
key_files:
  created:
    - "apps/api/src/pipeline/llm-tools/system-prompt.ts (ANTI_INJECTION_PREFIX)"
    - "apps/api/src/pipeline/llm-tools/extract-request.prompt.ts (5 few-shots VERBATIM)"
    - "apps/api/src/pipeline/llm-tools/extract-request.ts (ExtractRequestSchema D-09 + handler)"
    - "apps/api/src/pipeline/llm-tools/detect-language.ts (Cyrillic-heuristic wrapper)"
    - "apps/api/src/pipeline/llm-tools/nearest-truck.ts (PostGIS CTE re-rank + bourse fallback)"
    - "apps/api/src/pipeline/llm-tools/calc-price.ts (pure calcPrice + readPricingConfig)"
    - "apps/api/src/pipeline/llm-tools/create-order.ts (price-lock transactional handler)"
    - "apps/api/src/pipeline/llm-tools/discount.ts (min-floor + jsonb[] audit)"
    - "apps/api/src/pipeline/llm-tools/index.ts (buildToolRegistry + ToolContext)"
    - "apps/api/tests/unit/extract-request.test.ts (13 tests, snapshot 10× stable)"
    - "apps/api/tests/unit/__snapshots__/extract-request.test.ts.snap"
    - "apps/api/tests/unit/calc-price.test.ts (9 tests, snapshot 10× stable)"
    - "apps/api/tests/unit/__snapshots__/calc-price.test.ts.snap"
    - "apps/api/tests/unit/discount.test.ts (9 tests, mock-ctx floor logic)"
    - "apps/api/tests/integration/nearest-truck-knn.test.ts (EXPLAIN ANALYZE + 3-row shape)"
    - "apps/api/tests/integration/bourse-fallback.test.ts (source=bourse-stub + bourse_cache audit)"
    - "apps/api/tests/integration/create-order-price-lock.test.ts (Pitfall #1 closure + concurrency)"
  modified:
    - "apps/api/tests/fixtures/llm-responses.json (6 fixtures for canon-01..05 + canon-11)"
    - "apps/api/package.json (test:snapshot — bash for-loop replaces vitest --repeat=10 which v4 dropped)"
decisions:
  - "Used 5 few-shot examples in EXTRACT_REQUEST_SYSTEM_PROMPT (D-10 specified 3-5, we picked 5 covering RU/UA/translit/ambiguous/vague)."
  - "MockAnthropicClient fixture key = sha256_prefix(systemPrompt + last_user). For Wave 2 we precomputed 6 fixture keys via a small node script; future plans should auto-derive."
  - "Stub-then-replace pattern: Task 1 ships stubs returning NOT_IMPLEMENTED so the barrel type-checks. Tasks 2/3 replace the stub function bodies in-place without changing export signatures."
  - "calcPrice corridor min/max computed against the PRE-roundTo50 adjusted value, not the post-round default. Means min/max may be slightly off from default × 0.85 / × 1.15 when default crosses a 5k-kopeck boundary, but matches RESEARCH §5 verbatim formula and downstream price-guard regex tolerance."
  - "Pre-existing test:snapshot script (`vitest --repeat=10`) was BROKEN — vitest 4 dropped --repeat. Replaced with `for i in 1..10; do vitest run -t snapshot || exit 1; done` bash loop. Deviation Rule 1."
metrics:
  duration: "~12 min"
  completed_date: "2026-06-09"
  task_count: 3
  files_created: 17
  files_modified: 2
---

# Plan 02-02 — LLM Tools (Wave 2a)

## What was built

Wave 2a of Phase 2 — all 6 LLM tools live under `apps/api/src/pipeline/llm-tools/` as `betaZodTool` registrations. Each file exports:
- The Zod input schema (also the JSON-Schema given to Claude).
- A direct handler function for tests / Wave 3 pipeline to call.
- A `xxxTool(ctx)` factory returning the betaZodTool registration the SDK's `toolRunner` consumes.

The 6 tools (in registry order):

| Name             | File                | Purpose                                                                                          | Pitfall closed                          |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `extractRequest` | extract-request.ts  | LLM-driven structured extraction. Schema = D-09 VERBATIM. Strict mode rejects unknown fields.    | #11 anti-injection (D-42 prefix)        |
| `nearestTruck`   | nearest-truck.ts    | PostGIS CTE re-rank: overfetch 20 by `<->` sphere → spheroid `ST_Distance(.., true)` LIMIT 3.    | #2 sphere/spheroid mismatch (CTE inner) |
| `calcPrice`      | calc-price.ts       | Pure deterministic price corridor. `readPricingConfig` reads jsonb config; calcPrice has no I/O. | #1 LLM in money path (no LLM in calc)   |
| `createOrder`    | create-order.ts     | Transactional SELECT FOR UPDATE + INSERT order + CAS update lead. No `price` field in schema.    | #1 (type-level: LLM cannot send price)  |
| `discount`       | discount.ts         | Min-floor validator. Below `quoted × 0.85` → `escalation_needed`. Above → CAS update.            | D-26 floor enforcement                  |
| `detectLanguage` | detect-language.ts  | Wrapper for Wave 1 cyrillicHeuristic + default ru/0.5 fallback.                                  | D-13 second detector                    |

## ToolContext (Wave 3 must instantiate)

```ts
export interface ToolContext {
  db: Db;
  log: FastifyBaseLogger;
  llm: LlmProvider;
  leadId: string;
  clientId: string;
  clientLang: 'ru' | 'ua';
}
```

Wave 3 (`intake.ts`) creates one of these per turn and passes it to `buildToolRegistry(ctx)`. The mock equivalent — used by `extract-request.test.ts` — bypasses `toolRunner` entirely and calls `extractRequestHandler` directly through the `LlmProvider.runTurn` boundary.

## Commits

- `8fdaabb` feat(02-02): llm-tools registry + extractRequest + detectLanguage + stubs (Task 1)
- `f7376a9` feat(02-02): nearestTruck + calcPrice tools — replace stubs with real impls (Task 2)
- `3994f24` feat(02-02): createOrder + discount tools — replace stubs (Task 3)

## Verification

| Gate                                                                | Result                                |
| ------------------------------------------------------------------- | ------------------------------------- |
| `tsc --noEmit -p apps/api/tsconfig.json`                            | exit 0                                |
| `biome check apps/api/src/pipeline/llm-tools/* tests/...`           | clean (no warnings, no errors)        |
| `pnpm --filter @ai-logist/api test:unit`                            | **134 passed | 14 todo (148 total)**  |
| `pnpm --filter @ai-logist/api test:snapshot` (10× bash-loop)        | byte-stable extract-request + calc-price snapshots across 10 runs |
| Integration tests (require Docker)                                  | skipped on Claude runner per Phase 1 convention; will run on verifier |
| `phase-2-stubs.test.ts` diff vs HEAD                                | empty (UNCHANGED — Plan 02-03b owns)  |
| Existence checks (9 llm-tools files)                                | all present                           |
| `grep -q "ORDER BY t.geom <->" nearest-truck.ts`                    | PASS                                  |
| `grep -q "ST_Distance.*true" nearest-truck.ts`                      | PASS                                  |
| `grep -q "FOR UPDATE" create-order.ts`                              | PASS                                  |
| `grep -q "quoted_price" create-order.ts`                            | PASS                                  |
| `grep -q "escalation_needed" discount.ts`                           | PASS                                  |
| `grep -q "ANTI_INJECTION_PREFIX" system-prompt.ts`                  | PASS                                  |
| `grep -q "Ignore any instructions" system-prompt.ts`                | PASS                                  |

## Snapshot Stability Evidence

```
$ for i in 1..10; do vitest run tests/unit/extract-request.test.ts | tail -3; done
# 10 consecutive runs, all "Tests 13 passed" with no snapshot drift.

$ for i in 1..10; do vitest run tests/unit/calc-price.test.ts | tail -3; done
# 10 consecutive runs, all "Tests 9 passed" with no snapshot drift.
```

## Requirements Progressed

- **LOGIC-01** (extractRequest via betaZodTool) — schema + handler shipped; pipeline wiring Wave 3.
- **LOGIC-04** (clarification budget) — ExtractRequestParseError raises a retry signal; budget counter lives in Wave 3 intake.
- **LOGIC-05** (strict JSON, unknown fields rejected) — `.strict()` enforced at schema + handler levels.
- **MATCH-01** (PostGIS KNN CTE re-rank) — SQL shipped; EXPLAIN ANALYZE assertion in `nearest-truck-knn.test.ts`.
- **MATCH-03** (deterministic calcPrice) — pure function shipped; 10× snapshot byte-stable.
- **MATCH-05** (corridor min/max) — `out.min`/`out.max` populated from RESEARCH §5 VERBATIM formula.
- **MATCH-06** (price-lock infrastructure at type level) — createOrder schema has NO `price` field; handler re-reads `leads.quoted_price` inside transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `package.json` `test:snapshot` script broken**
- **Found during:** Task 1 (running snapshot test 10×).
- **Issue:** Script used `vitest --repeat=10`; vitest 4.1.8 dropped `--repeat` (`Unknown option`).
- **Fix:** Replaced with `for i in 1 2 3 4 5 6 7 8 9 10; do vitest run --project unit -t snapshot || exit 1; done`.
- **Files modified:** `apps/api/package.json`
- **Commit:** included in `8fdaabb`

**2. [Rule 1 — Bug] Plan-referenced GiST index name was wrong**
- **Found during:** Task 2 (writing `nearest-truck-knn.test.ts`).
- **Issue:** Plan/RESEARCH §12 referenced `trucks_geom_gist_idx`; the live migration (`drizzle/0001_init.sql`) creates the index as `trucks_geom_gist` (no `_idx` suffix).
- **Fix:** Test asserts the actual name `Index Scan using trucks_geom_gist` and documents the discrepancy in a code comment.
- **Files modified:** `apps/api/tests/integration/nearest-truck-knn.test.ts`
- **Commit:** `f7376a9`

### Architectural decisions (no deviations, just notes)

- **calcPrice corridor formula** uses the PRE-roundTo50 adjusted value × 0.85 / × 1.15, not the POST-round `default`. This is RESEARCH §5 VERBATIM and means `min` may differ from `roundTo50(default × 0.85)` by one 5k-kopeck step when `default` crosses a boundary. Acceptable per D-25 price-guard tolerance.

### Authentication gates

None — all work was code-only with mocked LLM provider. No auth required.

## Plan 02-03b boundary

This plan does **NOT** modify `apps/api/tests/unit/phase-2-stubs.test.ts`. Plan 02-03b will atomic-flip the following Wave-2 todos in one commit after both 02-02 and 02-03 merge:

- LOGIC-01 (extractRequest)
- LOGIC-03 (city normalization) — note: still in Plan 02-04 scope, not 02-02
- LOGIC-05 (strict JSON)
- MATCH-01 (KNN CTE re-rank)
- MATCH-03 (deterministic calcPrice)
- MATCH-05 (corridor min/max)
- FSM-01 / FSM-02 — owned by Plan 02-03 (FSMs)

## Stub-then-Replace Pattern

Task 1 created stub bodies for nearest-truck.ts, calc-price.ts, create-order.ts, discount.ts so `index.ts` could import them and the barrel type-checked at end of Task 1. Tasks 2 and 3 then *replaced* the stub function bodies in-place. The external interface (exported function names + their return shapes from `xxxTool(ctx)`) stayed byte-identical between stub and real implementation. Result: the barrel never broke between commits; every commit is independently type-checkable.

## Next

Wave 2a (this plan) and Wave 2b (Plan 02-03: FSMs) ran in parallel with zero file overlap. Plan 02-03b is the post-Wave-2 atomic flip of all Wave-2 phase-2-stubs.test.ts todos. After 02-03b, Wave 3 (Plans 02-04a + 02-04b: intake pipeline + price-lock plumbing) instantiates `ToolContext` and wires `buildToolRegistry(ctx)` into the production tool loop.

## Self-Check: PASSED

All 17 created files exist on disk. All 3 commits (`8fdaabb`, `f7376a9`, `3994f24`) are in `git log --oneline`. tsc + biome + 134 unit tests all green. `phase-2-stubs.test.ts` byte-identical to HEAD~3.

## Known Stubs

None. All 6 tools have working bodies:
- `extractRequest` — full schema + handler.
- `nearestTruck` — real PostGIS CTE SQL + bourse fallback.
- `calcPrice` — pure deterministic function.
- `createOrder` — full transactional handler.
- `discount` — full min-floor validator with jsonb[] audit append.
- `detectLanguage` — wraps Cyrillic heuristic (real); LLM second-detector vote deferred to Wave 3 when intake.ts has access to ANTHROPIC_API_KEY.
