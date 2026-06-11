---
phase: 05-demo-polish-notifications-final-i18n
plan: 04
subsystem: demo-polish
tags:
  - polish-02
  - polish-05
  - polish-06
  - simulate-call
  - llm-adapter
  - preflight
dependency-graph:
  requires:
    - 05-00-test-infra
    - 05-02-i18n-core
    - 05-03-snapshot-format-date
  provides:
    - admin-route:/api/admin/simulate-call
    - llm-provider-factory
    - preflight-check-script
    - openai-adapter
    - anthropic-adapter
  affects:
    - apps/api/src/lib/llm/
    - apps/api/src/routes/admin.ts
    - apps/api/src/app.ts
    - apps/api/scripts/preflight.ts
    - apps/api/src/fixtures/voice-scenarios.json
    - apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx
tech-stack:
  added:
    - openai@4.104.0 (EXACT pin, no caret)
  patterns:
    - LLM provider factory (singleton)
    - Voice-handler in-process replay via app.inject
    - Preflight sequential fail-fast (D-34)
key-files:
  created:
    - apps/api/src/lib/llm/provider.ts
    - apps/api/src/lib/llm/anthropic-adapter.ts
    - apps/api/src/lib/llm/openai-adapter.ts
    - apps/api/src/routes/admin.ts
    - apps/api/scripts/preflight.ts
    - apps/web/src/app/(main)/dashboard/calls/_components/simulate-call-modal.tsx
  modified:
    - apps/api/package.json (add openai@4.104.0)
    - apps/api/src/config.ts (add LLM_PROVIDER + OPENAI_API_KEY + OPENAI_MODEL)
    - apps/api/src/app.ts (register adminRoutes)
    - apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx (add Simulate button)
    - .env.example (document LLM_PROVIDER + OPENAI_*)
    - package.json (root preflight script)
    - apps/api/tests/integration/voice-tool-handlers.test.ts (update fixture path)
    - apps/api/tests/integration/voice-injection.test.ts (update fixture path)
    - apps/api/tests/integration/simulate-call.test.ts (flip from test.todo to 6 it() blocks)
    - apps/api/tests/unit/llm-provider-adapter.test.ts (flip from test.todo to 9 it() blocks)
    - apps/api/tests/unit/preflight-script-shape.test.ts (flip from test.todo to 11 it() blocks)
    - apps/api/tests/unit/phase-5-stubs.test.ts (flip 3 markers: POLISH-02 + POLISH-05 + POLISH-06; count 4 → 1)
    - apps/web/tests/unit/pages-smoke.test.ts (extend swr mock with useSWRConfig)
  renamed:
    - apps/api/tests/fixtures/voice-scenarios.json → apps/api/src/fixtures/voice-scenarios.json
decisions:
  - "openai@4.104.0 EXACT pin (no caret) per RESEARCH Open Q1 — avoids silent v6 dist-tag drift"
  - "OpenAI mapper does JSON.parse(tc.function.arguments) wrapped in try/catch (Pitfall §5)"
  - "Anthropic mapper reads block.input directly — SDK returns parsed object (no parse needed)"
  - "voice-scenarios.json moved tests/fixtures → src/fixtures so production simulate-call route reads from build output (Pitfall §7)"
  - "Simulate route replays via app.inject to existing /webhook/voice/* endpoints (no duplication; reuses HMAC + advisory lock + idempotency)"
  - "Preflight uses sequential for-loop with break on first failure (D-34 fail-fast); --json flag for machine output"
metrics:
  duration: "17m"
  completed: "2026-06-11"
  tasks: 3
  commits: 3
  files-touched: 17
  new-files: 6
  unit-tests-added: 26
  integration-tests-added: 6
---

# Phase 5 Plan 04: Simulate-call + LLM Adapter + Preflight Summary

Three demo-day insurance deliverables land: **POLISH-02** simulate-call route + frontend modal, **POLISH-06** LLM provider adapter (Anthropic + OpenAI with JSON.parse on function.arguments per Pitfall §5), **POLISH-05** preflight script (6 sequential fail-fast checks per D-34). Marker count flipped 4 → 1; only POLISH-03 (video) remains for Wave 5.

## One-liner

OpenAI/Anthropic dual-provider adapter with JSON-string parse guard, in-process voice-scenario replay via /api/admin/simulate-call, and a 6-check sequential preflight script with --json output.

## What Shipped

### POLISH-06 — LLM provider adapter (Task 1)

- **`openai@4.104.0` EXACT pin** in apps/api/package.json (no caret — avoids silent v6 dist-tag drift per RESEARCH Open Q1)
- **`apps/api/src/lib/llm/provider.ts`** — `getLLMClient()` singleton factory routes by `config.LLM_PROVIDER`; exposes `LlmProvider` interface + `_resetLLMClientForTesting()` for test cleanup
- **`apps/api/src/lib/llm/anthropic-adapter.ts`** — `AnthropicAdapter` class wraps `@anthropic-ai/sdk`. Reads `block.input` directly (SDK contract: already-parsed object)
- **`apps/api/src/lib/llm/openai-adapter.ts`** — `OpenAIAdapter` class wraps `openai@4.104.0`. CRITICAL per Pitfall §5: mapper calls `JSON.parse(tc.function.arguments)` in try/catch — throws descriptive error if malformed
- **`apps/api/src/config.ts`** — adds `LLM_PROVIDER` (enum, default `'anthropic'`), `OPENAI_API_KEY` (optional), `OPENAI_MODEL` (default `'gpt-4o'`)
- **`.env.example`** — documents the 3 new vars with swap instructions
- **`apps/api/tests/unit/llm-provider-adapter.test.ts`** — 9 it() blocks: both adapters implement LlmProvider; OpenAI mapper parses JSON-string args; OpenAI mapper throws on malformed JSON; Anthropic mapper consumes block.input directly; singleton lifecycle; reset clears cache

### POLISH-02 — Simulate-call route + frontend modal (Task 2)

- **Relocation:** `voice-scenarios.json` moved from `tests/fixtures/` → `src/fixtures/` per RESEARCH Open Q2 + Pitfall §7. Phase 3.1 test imports updated (`voice-tool-handlers.test.ts`, `voice-injection.test.ts`)
- **`apps/api/src/routes/admin.ts`** — `POST /api/admin/simulate-call` accepts `{ scenarioKey }` (Zod enum of 5 scenarios). Replays each scenario event via `app.inject` against existing `/webhook/voice/*` endpoints. Signs `tool/*` events with `ELEVENLABS_WEBHOOK_SECRET` so the HMAC preHandler accepts in-process replay. Returns `{ callId, leadId, orderId }`
- **`apps/api/src/app.ts`** — registers `adminRoutes` after `callsRoutes`
- **`apps/web/.../simulate-call-modal.tsx`** — `'use client'` Dialog with 5 scenario buttons. SWR `useSWRConfig().mutate` refetches `/api/calls*` on success. Sonner toast feedback
- **`apps/web/.../calls-app.tsx`** — header gains `▶ Simulate inbound call` button + modal state
- **`apps/api/tests/integration/simulate-call.test.ts`** — 6 it() blocks (Docker-gated): 400 on invalid key, 5 scenario asserts including **Anti-Pitfall #1 invariant** (`injection_attempt` does NOT create a 1-RUB order — verified via DB SELECT on `orders.price_kopecks`)
- **`apps/web/tests/unit/pages-smoke.test.ts`** — extended `swr` mock with `useSWRConfig` (consumed by new modal)

### POLISH-05 — Preflight script (Task 3)

- **`apps/api/scripts/preflight.ts`** (181 lines, executable) — 6 SEQUENTIAL fail-fast checks per CONTEXT D-34 verbatim:
  1. **Telegram bot alive** — `new Bot(token).api.getMe()` returns `username`
  2. **Twilio number registered** — `twilio.incomingPhoneNumbers.list({ phoneNumber })` returns ≥ 1 row
  3. **DB seeded** — `SELECT COUNT(*) FROM trucks WHERE status='available'` must be ≥ 10
  4. **/api/health** — HTTP 200 + `checks.postgis` matches `/^3\.5/`
  5. **LLM key check** — `anthropic.messages.create({ max_tokens: 1, messages: [{role:'user',content:'ping'}] })`
  6. **E2E smoke (RU + UA)** — `POST /api/admin/simulate-call` for both `ru_happy_path` + `ua_happy_path`; both must produce `orderId`
- Sequential for-loop with `break` on first failure (D-34 fail-fast). Exit 0 on all-pass, 1 on any-fail. Total runtime budget ≤ 30s
- `--json` flag emits `{ exitCode, results: [{name, status, duration_ms, error?}] }` for machine consumption
- **Root `package.json`** — adds `preflight` script: `pnpm preflight` → `pnpm --filter @ai-logist/api exec tsx --env-file=../../.env.local scripts/preflight.ts`
- **`apps/api/tests/unit/preflight-script-shape.test.ts`** — 11 it() blocks verify shape via `readFileSync` (no real API calls per D-50 + VALIDATION)

### Marker flip (Task 3 final)

- **`apps/api/tests/unit/phase-5-stubs.test.ts`** — `test.todo` count 4 → 1: POLISH-02 + POLISH-05 + POLISH-06 flipped to `test.skip` with validation references; only POLISH-03 (video) remains for Wave 5

## Anti-Pitfall + Pitfall Mitigations

- **Anti-Pitfall #1 (price-lock):** Simulate route reuses Phase 3.1 voice tool handlers byte-identically. Prices come from `leads.quoted_price` DB column (set by `calc-price` handler before return). The simulate route NEVER injects a price. `injection_attempt` integration test asserts `orders.price_kopecks` ≠ 100 (NOT 1 RUB)
- **Pitfall §5 (OpenAI JSON.parse):** `OpenAIAdapter` mapper wraps `JSON.parse(tc.function.arguments)` in try/catch; throws descriptive error on malformed JSON. Unit test covers BOTH paths: happy path (valid JSON-string → parsed object) and failure path (`'NOT JSON'` → throws `/not valid JSON/`)
- **Pitfall §7 (fixture relocation):** `voice-scenarios.json` moved from `tests/fixtures/` to `src/fixtures/`. Phase 3.1 test imports updated to `../../src/fixtures/voice-scenarios.json`. Verified Phase 3.1 tests still gate correctly under Docker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] pages-smoke.test.ts swr mock missing useSWRConfig**

- **Found during:** Task 2 (web test run)
- **Issue:** New `SimulateCallModal` imports `useSWRConfig` from `swr`. Pre-existing `pages-smoke.test.ts` mocks only the `default` export, so the test render crashed with `No "useSWRConfig" export is defined on the "swr" mock`
- **Fix:** Extended the `vi.mock('swr', ...)` block to also export `useSWRConfig: () => ({ mutate: vi.fn() })`. Added comment referencing Plan 05-04 so future maintainers see the rationale
- **Files modified:** `apps/web/tests/unit/pages-smoke.test.ts`
- **Commit:** `c6d36fb` (Task 2, amended)

### Minor Plan Deviations

**2. [Plan correction] TWILIO_PHONE_NUMBER vs TWILIO_NUMBER**

- Plan referred to `config.TWILIO_NUMBER`; actual config.ts uses `TWILIO_PHONE_NUMBER`. Preflight script uses the correct name. No fix needed beyond using the right env var

**3. [Cosmetic] Biome formatting**

- Biome auto-formatted `apps/api/src/routes/admin.ts`, `apps/api/tests/integration/simulate-call.test.ts`, `apps/web/.../simulate-call-modal.tsx`, and `apps/api/scripts/preflight.ts` during the final lint pass. No semantic change; only whitespace/line-break adjustments

## Self-Check

### Files exist

- `apps/api/src/lib/llm/provider.ts` — FOUND
- `apps/api/src/lib/llm/anthropic-adapter.ts` — FOUND
- `apps/api/src/lib/llm/openai-adapter.ts` — FOUND
- `apps/api/src/routes/admin.ts` — FOUND
- `apps/api/scripts/preflight.ts` — FOUND
- `apps/api/src/fixtures/voice-scenarios.json` — FOUND
- `apps/api/tests/fixtures/voice-scenarios.json` — MOVED (correctly absent)
- `apps/web/src/app/(main)/dashboard/calls/_components/simulate-call-modal.tsx` — FOUND
- `apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx` — MODIFIED

### Commits exist

- Task 1: `59f5f2a` — `feat(05-04): land POLISH-06 LLM provider adapter (Anthropic + OpenAI)` — FOUND
- Task 2: `c6d36fb` — `feat(05-04): land POLISH-02 simulate-call route + modal + relocate fixtures` — FOUND
- Task 3: `7d54819` — `feat(05-04): land POLISH-05 preflight script + flip 3 phase-5-stubs markers` — FOUND

### Test counts

- Unit (api): 350 passed | 10 skipped | 1 todo (POLISH-03 remains)
- Web: 34 passed | 1 todo
- Integration (api): simulate-call gated by Docker — properly skips when daemon offline; pre-existing tests fail only because Docker daemon not running locally (out of scope per Phase 5 deferred-items policy)
- Marker count in phase-5-stubs.test.ts: 1 (was 4 entering Wave 4) ✓

### Typecheck + Lint

- `pnpm --filter @ai-logist/api exec tsc --noEmit` — clean ✓
- `pnpm --filter @ai-logist/web exec tsc --noEmit` — clean ✓
- `pnpm exec biome check {touched files}` — clean ✓
- `pnpm --filter @ai-logist/web build` — succeeded ✓

## Self-Check: PASSED
