---
plan: 02-01-migration-lib-llm-client
phase: 02-llm-pipeline-deterministic-core-high-risk
status: complete
tasks_completed: 3/3
date: 2026-06-09
---

# Plan 02-01 — Migration 0002 + Lib Primitives + LLM Client

## What was built

Wave 1 foundation of Phase 2 — migration adding token-cost ledger columns + `lead_events` audit table + `lead_event_actor` ENUM; 6 pure lib primitives that downstream LLM tools and the pipeline will compose; the Anthropic SDK wrapper with `LlmProvider` interface that both production and `MockAnthropicClient` (Wave 0) implement.

**Plan 02-01 was orchestrated as 3 tasks. The executor agent completed all 3 but the final completion signal was lost to an API ConnectionRefused after ~90 min. Spot-checks below confirm all artifacts landed; this SUMMARY is the orchestrator's manual closure.**

## Commits

- `5adf50e` feat(02-01): migration 0002 + lead_events schema/repo + token-ledger columns
- `19d6d40` feat(02-01): lib primitives + 4 phase-2-stubs todos flipped
- `2b49c3c` feat(02-01): Anthropic LLM client wrapper + runToolLoop helper

## Key Files

### Database & migration
- `apps/api/drizzle/0002_phase2_lead_events_tokens.sql` — adds `leads.{tokens_in,tokens_out,llm_calls}` columns (NO re-add of `leads.version` — Phase 1 already shipped it, Pitfall #4 avoided)
- `apps/api/drizzle/meta/_journal.json` — bumped
- `apps/api/src/persistence/schema/_enums.ts` — adds `lead_event_actor` enum (`'ai' | 'manager' | 'system'`)
- `apps/api/src/persistence/schema/lead_events.ts` — new audit table
- `apps/api/src/persistence/schema/index.ts` — barrel append
- `apps/api/src/persistence/repos/lead_events.ts` — thin repo
- `apps/api/src/persistence/repos/index.ts` — barrel append
- `apps/api/tests/unit/lead-events-schema-introspect.test.ts` — Docker-less smoke via `getTableConfig` (INFO #8 fix from plan-checker iteration 1)

### Lib primitives (`apps/api/src/lib/`)
- `money.ts` — `roundTo50Rubles(kopecks: bigint)` rounding to nearest 5000 kopecks (D-27)
- `price-guard.ts` — regex matching "23 800", "23,800", "23800", "23.8 тыс" + verifyAgainst(quoted_price, corridor) (RESEARCH.md §15)
- `lang-detect.ts` — Cyrillic-script heuristic (є/і/ї/ґ → UA confidence=1.0), with ≥20-char gate before sticky storage (D-12/D-13/D-14, RESEARCH.md §16)
- `geocoding.ts` — Nominatim adapter with `User-Agent: ai-logist/0.2 (...)` per usage policy (RESEARCH.md §9), country_bias=ru,ua
- `routing.ts` — OSRM adapter with haversine ×1.3 fallback (D-21, RESEARCH.md §8)
- `bourse-stub.ts` + `bourse-stub.json` — 5 fake external trucks with source='ati.su'|'lardi' (D-23)

### LLM client (`apps/api/src/pipeline/`)
- `llm-client.ts` — `AnthropicLlmClient implements LlmProvider` + `runToolLoop` helper that wraps `client.beta.messages.toolRunner` (RESEARCH.md §1)
- `apps/api/tests/unit/llm-client.test.ts` — unit smoke

### Test suite + config
- `apps/api/tests/unit/{money,price-guard,lang-detect,routing}.test.ts` — 4 lib primitives have ≥1 unit test each
- `apps/api/tests/unit/phase-2-stubs.test.ts` — 4 todos flipped (LOGIC-02, MATCH-02, MATCH-04, MATCH-06)
- `apps/api/src/config.ts` — extended Zod env with `ANTHROPIC_API_KEY` (required), `LLM_MODEL` (default `claude-sonnet-4-7`), `LLM_TOKEN_BUDGET_PER_LEAD` (default 30000), `OSRM_URL`, `NOMINATIM_URL`
- `.env.example` — documented new env vars
- `apps/api/package.json` — `@anthropic-ai/sdk@0.102.x` already from Phase 1; no new top-level deps

## Verification

- `tsc --noEmit -p apps/api/tsconfig.json` → exit 0
- `cd apps/api && pnpm exec vitest run --project unit` → **72 passed / 14 todo** (was 18 todo after Wave 0; -4 flipped = 14 remaining)
- `! grep -q 'ADD COLUMN "version"' apps/api/drizzle/0002_*.sql` → PASS (Pitfall #4 avoided)
- `grep -q "lead_event_actor" apps/api/src/persistence/schema/_enums.ts` → PASS
- `grep -q "User-Agent.*ai-logist" apps/api/src/lib/geocoding.ts` → PASS (Nominatim policy)
- `grep -q "runToolLoop" apps/api/src/pipeline/llm-client.ts` → PASS
- `grep -q "LlmProvider" apps/api/src/pipeline/llm-client.ts` → PASS

## Requirements Progressed

- **LOGIC-02** (sticky language detection) — lib primitive shipped; integration into pipeline pending Wave 4 (02-04a)
- **MATCH-02** (bourse fallback stub) — JSON fixture + adapter shipped; integration pending Wave 2 (02-02 nearestTruck tool)
- **MATCH-04** (route distance OSRM + haversine fallback) — adapter shipped; tool wiring Wave 2
- **MATCH-06** (price-lock infrastructure) — money helper + regex guard shipped; protocol wiring Wave 4/5 (02-04b)

## Deviations

1. **Final Task 3 completion signal lost to API ConnectionRefused.** Artifacts manually committed by orchestrator (commit 2b49c3c) after spot-check (`tsc --noEmit` clean, 72 unit tests pass, llm-client.ts implements `LlmProvider` interface that matches `tests/_helpers/mock-anthropic.ts`).
2. **Plan revision files (02-03b, 02-04a, 02-04b PLAN.md) not committed by planner** — caught here and committed via `f45c6d9`.
3. None of the gotchas surfaced (no Pitfall #4 regression, no Nominatim 403 risk, no version conflict).

## Next

Wave 2: Plans 02-02 (LLM tools) and 02-03 (FSMs) — designed to run in parallel (zero file overlap).
