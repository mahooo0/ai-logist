---
phase: 2
slug: llm-pipeline-deterministic-core-high-risk
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for the highest-risk phase of the project.
> 5 critical pitfalls cluster here — every defense must be testable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (continued from Phase 1) — three projects: unit / integration / smoke |
| **Config file** | `apps/api/vitest.config.ts` (extended in Wave 0 — adds `__snapshots__/` patterns + fake-timers setup) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit` |
| **Snapshot stability command** | `pnpm --filter @ai-logist/api exec vitest run --project unit --repeat=10 -t snapshot` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | unit ~5s, integration ~60s (testcontainers PostGIS boot), snapshot repeat×10 ~30s |

Auxiliary commands:
- `pnpm --filter @ai-logist/api typecheck` — `tsc --noEmit`
- `pnpm exec biome check .` — lint + format
- `pnpm db:migrate:check` — re-apply migrations, expect zero diff
- `pnpm --filter @ai-logist/api test:llm` — gated on `ANTHROPIC_API_KEY` env (real LLM smoke, not in CI)

---

## Sampling Rate

- **After every task commit:** Run typecheck + biome on changed files + relevant unit test slice
- **After every plan wave:** Run `pnpm test:unit` + `pnpm test:integration` full
- **Before `/gsd:verify-work`:** Full suite green, including 10× snapshot-stability run
- **Max feedback latency:**
  - typecheck/unit: 30s
  - integration (testcontainers): 90s (PG boot is the long pole)
  - snapshot×10 stability: 60s

---

## Per-Task Verification Map

(Filled by planner — placeholder shape below. Each task must own one row.)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | 00 | 0 | infra | bootstrap | `test -f apps/api/tests/_helpers/dialog-harness.ts && test -f apps/api/tests/fixtures/canonical-inputs.json` | ❌ W0 | ⬜ pending |
| 2-W0-02 | 00 | 0 | infra | bootstrap | `test -f apps/api/tests/fixtures/llm-responses.json && grep -q "MockAnthropicClient" apps/api/tests/_helpers/llm-mock.ts` | ❌ W0 | ⬜ pending |
| 2-W0-03 | 00 | 0 | infra | stubs | `grep -c "test.todo" apps/api/tests/unit/phase-2-stubs.test.ts` ≥ 18 | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 1 | LOGIC-02 | unit | `vitest run lang-detect` | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 1 | MATCH-03 | unit | `vitest run calc-price.test` (deterministic snapshot) | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 1 | LOGIC-03 | integration | `vitest run --project integration geocoding.test` | ❌ W0 | ⬜ pending |
| 2-01-XX | 01 | 1 | MATCH-04 | unit | `vitest run osrm-haversine-fallback.test` | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 2 | LOGIC-01 | unit+snap | `vitest run --repeat=10 extractRequest.snapshot.test` | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 2 | MATCH-01 | integration | `vitest run --project integration knn-rerank.test` (incl. EXPLAIN ANALYZE assertion) | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 2 | MATCH-02 | unit | `vitest run bourse-stub.test` | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 2 | FSM-01,03,05 | integration | `vitest run --project integration lead-fsm-concurrency.test` (Promise.all → exactly 1 success) | ❌ W0 | ⬜ pending |
| 2-02-XX | 02 | 2 | FSM-02,03 | integration | `vitest run --project integration order-fsm.test` | ❌ W0 | ⬜ pending |
| 2-03-XX | 03 | 3 | MATCH-05,06 | unit | `vitest run price-guard-regex.test` (RU/UA price format coverage) | ❌ W0 | ⬜ pending |
| 2-03-XX | 03 | 3 | LOGIC-04,05 | integration | `vitest run --project integration pipeline-script.test` (full runScript E2E) | ❌ W0 | ⬜ pending |
| 2-03-XX | 03 | 3 | FSM-04 | integration | `vitest run --project integration advisory-lock.test` | ❌ W0 | ⬜ pending |
| 2-03-XX | 03 | 3 | FSM-06 | integration | `vitest run --project integration follow-up-scheduler.test` (fake-timers tick advances) | ❌ W0 | ⬜ pending |
| 2-04-XX | 04 | 4 | API-07 | integration | `vitest run --project integration api-leads-routes.test` (POST /:id/match, /:id/quote) | ❌ W0 | ⬜ pending |
| 2-04-XX | 04 | 4 | all | smoke | `vitest run --project unit phase-2-stubs.test` (≥18 passing, 0 todo) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 ships test infrastructure BEFORE any production code. All items green before Wave 1 starts.

### Test Harness & Fixtures
- [ ] **`apps/api/tests/_helpers/dialog-harness.ts`** — `runScript(client_id, messages: ScriptMessage[]): Promise<RunResult>` helper; bypasses webhooks; calls `pipeline/intake.ts` directly
- [ ] **`apps/api/tests/_helpers/llm-mock.ts`** — `MockAnthropicClient` implementing the same interface as production `LlmClient`; reads from fixtures keyed by (tool_name, message_hash)
- [ ] **`apps/api/tests/_helpers/fake-timers.ts`** — Centralized `vi.useFakeTimers({ now: '2026-06-09T12:00:00Z' })` setup for snapshot stability
- [ ] **`apps/api/tests/_helpers/db-seed.ts`** — Per-test deterministic seed (fixed UUIDs via `crypto.randomUUID` mock or seeded RNG)
- [ ] **`apps/api/tests/fixtures/canonical-inputs.json`** — 20 canonical inputs covering RU, UA, EN-translit, ambiguous tons, missing fields, surzhyk, prompt-injection
- [ ] **`apps/api/tests/fixtures/llm-responses.json`** — Mock LLM responses keyed by tool+prompt-hash
- [ ] **`apps/api/tests/fixtures/cities-extra.json`** — 5 extra cities not in seed (forces Nominatim path in geocoding tests)

### Test Categories
- [ ] **`apps/api/tests/unit/phase-2-stubs.test.ts`** — 18 `test.todo()` markers, one per Phase 2 requirement (LOGIC-01..05, MATCH-01..06, FSM-01..06, API-07)
- [ ] **`apps/api/vitest.config.ts`** updates — snapshot dir, fake-timers setup, increased timeout for integration
- [ ] **`apps/api/package.json`** — add scripts: `test:llm`, `test:snapshot`
- [ ] **CI guard:** Wave 0 commit must include `tests/PHASE-2.md` documenting harness usage

### Validation Architecture (from RESEARCH.md §17)
All 21 W0 gaps enumerated in `02-RESEARCH.md` "Validation Architecture" section must be addressed by W0 plan tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `claude-sonnet-4-7` smoke through extractRequest tool | LOGIC-01 | Requires real ANTHROPIC_API_KEY + network; not in CI by default | Set `ANTHROPIC_API_KEY=sk-…` env; run `pnpm test:llm`; confirm one extraction roundtrip returns valid Zod-parsed object |
| Real Nominatim geocoding (rate-limit aware) | LOGIC-03 | Public Nominatim has 1 req/sec hard cap | Local-only verification: `pnpm exec tsx apps/api/src/lib/geocoding-cli.ts "Луганск"` returns coordinates |
| Real OSRM route distance | MATCH-04 | Public OSRM demo is shared | `pnpm exec tsx apps/api/src/lib/routing-cli.ts kyiv lviv` returns ~540 km |
| Real Anthropic prompt injection rejection | LOGIC-05, anti-injection | Verifies system prompt actually rejects "ignore previous instructions" type attacks | Manual test via REPL: send 5 known injection patterns from `tests/fixtures/injection-attempts.json`; confirm extractRequest returns null+clarifying question, no mutated tool args |

---

## Validation Sign-Off

- [ ] All 4 plans have `<automated_check>` blocks for every task
- [ ] Snapshot tests stable across 10 consecutive runs (success criterion #2)
- [ ] EXPLAIN ANALYZE assertion confirms GiST `Index Scan` (success criterion #3)
- [ ] FSM concurrency test deterministic: 100 runs, always exactly 1 success + 1 VersionMismatch (success criterion #4)
- [ ] Sticky-lang detection test: "ок" → "Київ-Львів 18т" → all subsequent replies UA (success criterion #5)
- [ ] End-to-end runScript dialog: "Киев-Львов 18 тонн тент" → `ORDER_CREATED` in <2s with mocked LLM (success criterion #1)
- [ ] Feedback latency: typecheck <30s, unit <30s, snapshot×10 <60s, integration <90s
- [ ] `nyquist_compliant: true` set after planner fills the Per-Task table

**Approval:** pending

---

## Notes for Planner

- **MUST produce 1 Wave 0 plan** shipping all test infrastructure BEFORE any production code
- **MUST tag every task with `<automated_check>`** matching commands in this strategy
- **For LLM tool tests:** Always use `MockAnthropicClient` (not real Anthropic) for unit + snapshot tests. Real Anthropic only in gated `test:llm` smoke
- **For PostGIS tests:** Use testcontainers (already wired in Phase 1)
- **Snapshot stability technique:** `vi.useFakeTimers({ now: '2026-06-09T12:00:00Z' })` + seed crypto.randomUUID with deterministic UUID-v4 generator (see RESEARCH.md §10)
- **Wave structure suggestion** (per RESEARCH.md):
  - W0: test infra (1 plan)
  - W1: migration + lib/* primitives + llm-client wrapper (1 plan)
  - W2: LLM tools (extractRequest, nearestTruck, calcPrice, createOrder, discount) + FSMs (lead, order) (1-2 plans)
  - W3: pipeline/intake.ts orchestration + price-lock + follow-up scheduler (1 plan)
  - W4: routes/leads.ts un-stub for POST /:id/match + /:id/quote + integration tests (1 plan)
- **Migration 0002 covers ONLY** `tokens_in/tokens_out/llm_calls` columns + `lead_events` table + `lead_event_actor` enum. `leads.version` ALREADY EXISTS (Phase 1 shipped it).
