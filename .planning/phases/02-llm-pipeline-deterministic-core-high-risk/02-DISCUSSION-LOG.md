# Phase 2: LLM Pipeline + Deterministic Core — Discussion Log

> **Audit trail only.** Decisions captured in 02-CONTEXT.md.

**Date:** 2026-06-09
**Phase:** 02-llm-pipeline-deterministic-core-high-risk
**Mode:** auto (recommended option selected for every question)
**Areas discussed:** 15 gray areas — LLM provider/model, tool registry pattern, extractRequest design, sticky language detection, city normalization, KNN pattern, OSRM/haversine fallback, bourse stub, calcPrice corridor, price-lock protocol, lead FSM, order FSM, concurrency strategy, token-cost ledger, test harness shape

---

## LLM Provider & Model

| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic Claude (sonnet-4-7) via betaZodTool | Stack already locked; tool-calling automated via Zod helper. | ✓ |
| Claude opus-4-7 | More accurate but 5× cost. Overkill for extraction. | |
| OpenAI GPT-4o failover | Possible but adds second SDK and key. Deferred to POLISH-06. | |

**Auto:** Sonnet-4-7 default; opus reserved for retries.

---

## Tool Registry Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| One-file-per-tool + registry barrel | Each tool has its own schema + handler; importable. | ✓ |
| Monolithic tools.ts | Faster prototyping; harder to test in isolation. | |
| Class-based ToolRegistry | DI / hooks. Overkill. | |

**Auto:** File-per-tool with `apps/api/src/pipeline/llm-tools/<name>.ts` + barrel.

---

## extractRequest Design

| Option | Description | Selected |
|--------|-------------|----------|
| Single-call + confidence + clarification budget=2 | Best UX/cost trade-off. | ✓ |
| Multi-call CoT (chain of thought) | More accurate but 3× tokens. | |
| Streaming partial extraction | Premature optimization. | |

**Auto:** Single-call with strict JSON schema + few-shot examples + 2-round clarification budget.

---

## Sticky Language Detection (Pitfall #7)

| Option | Description | Selected |
|--------|-------------|----------|
| Two-detector vote (Cyrillic char + fastText/LLM) + ≥20-char gate, sticky in clients.lang | Closes Surzhyk + short-message pitfalls. | ✓ |
| Per-message detection | Risk of mid-conversation flipping (Pitfall #7). | |
| Manual language selection at first contact | Friction for clients. | |

**Auto:** Two-detector vote, sticky after ≥20-char message; default RU if uncertain; UA wins on any є/і/ї/ґ marker.

---

## City Normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Local cities table ILIKE → Nominatim fallback (country_bias=ru,ua) | Cached, no rate-limit hit for seeded cities. | ✓ |
| Always-Nominatim | Rate-limit risk + latency. | |
| LLM does normalization | Hallucination risk. | |

**Auto:** Local-first, Nominatim fallback with country bias.

---

## KNN PostGIS Pattern (Pitfall #2)

| Option | Description | Selected |
|--------|-------------|----------|
| CTE re-rank (overfetch 20 by `<->` + spheroid ST_Distance LIMIT 3) | Closes sphere/spheroid mismatch. | ✓ |
| Simple `<->` LIMIT 3 | Wrong distances on long routes. | |
| ST_Distance only | Loses GiST index acceleration. | |

**Auto:** CTE re-rank pattern with filters inside CTE.

---

## Route Distance (OSRM vs haversine)

| Option | Description | Selected |
|--------|-------------|----------|
| OSRM public server → haversine ×1.3 fallback | Free for demo; reliable fallback. | ✓ |
| Mapbox Directions API | Paid; deferred to v2. | |
| Always haversine | Inaccurate on long routes. | |

**Auto:** OSRM primary, haversine ×1.3 fallback with warning log.

---

## Bourse Fallback (Phase 2 form)

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-fixture stub returning fake external trucks | Demo-credibility without real API quota. | ✓ |
| Real ATI.SU API | Quota / auth complexity. Deferred to v2 EXT-01. | |
| Empty result | Misses §4.6 capability. | |

**Auto:** JSON-fixture stub at `apps/api/src/lib/bourse-stub.json`.

---

## calcPrice Corridor

| Option | Description | Selected |
|--------|-------------|----------|
| {min=default×0.85, default, max=default×1.15} rounded to 50 RUB | Clear bargaining range, simple rule. | ✓ |
| Fixed ±10% | Less aggressive discounts. | |
| Per-direction corridor from config | Overengineered for v1. | |

**Auto:** ±15% corridor rounded to 50 RUB, configurable in pricing_config later.

---

## Price-Lock Protocol (Pitfall #1)

| Option | Description | Selected |
|--------|-------------|----------|
| Templated reply with DB substitution + post-LLM regex guard | Structural defense, not promptual. | ✓ |
| Prompt-only: "do not change price" | Easily bypassed by injection. | |
| Multi-call validation | Double cost for marginal gain. | |

**Auto:** Templated reply, write `quoted_price` to DB BEFORE rendering, regex guard rejects numbers ≠ quoted_price/[min,max].

---

## Lead FSM Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled transition table + SELECT FOR UPDATE + version column | Already locked in CONTEXT D-06 (Phase 1). | ✓ |
| XState | Overkill — no nested/parallel states. | |
| Workflow engine (Temporal etc.) | Out of scope. | |

**Auto:** Hand-rolled with lead_events audit table (new in Phase 2).

---

## Order FSM Implementation

Same approach as Lead FSM. order_events already exists from Phase 1 with UNIQUE(order_id, type) for idempotency.

**Auto:** Hand-rolled, reuses order_events audit table.

---

## Concurrency Strategy (Pitfall #6)

| Option | Description | Selected |
|--------|-------------|----------|
| SELECT FOR UPDATE + version compare-and-set + pg_advisory_xact_lock per-client | Belt + suspenders. | ✓ |
| Optimistic only (version column) | Lost-update window. | |
| Pessimistic only (FOR UPDATE) | No version tracking. | |

**Auto:** Optimistic version + pessimistic FOR UPDATE + advisory lock per-client.

---

## Token-Cost Ledger (Pitfall #12)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-lead accumulators on leads table + 30k budget → LOST | Simple, observable, no extra service. | ✓ |
| External LangSmith / OpenTelemetry | Adds dependency for demo. | |
| No tracking | Pitfall #12 exposed. | |

**Auto:** leads.tokens_in/out/llm_calls columns, 30k cap, auto-LOST + alert.

---

## Test Harness Shape

| Option | Description | Selected |
|--------|-------------|----------|
| `runScript(client_id, [{from,text}])` direct pipeline calls + mocked LLM fixtures | Fast deterministic, gates CI. | ✓ |
| Spawn full Fastify + fake webhook | Slow, flaky. | |
| Cypress E2E | Out of scope. | |

**Auto:** `runScript` helper in `apps/api/tests/_helpers/dialog-harness.ts`, fixture-based LLM responses.

---

## Claude's Discretion

- Exact prompt structure per tool (system / few-shot / message)
- fastText package selection vs Anthropic-based detection for D-13 step 2
- OSRM caching wrapper (in-memory LRU vs Redis)
- Background-job mechanism for auto-follow-up (`setInterval` for demo, BullMQ deferred)

## Deferred Ideas

- Real OpenAI failover → Phase 6 POLISH-06
- BullMQ for jobs → v2 PROD-01
- Conversation summarization (vs truncate) → v2
- Real ATI.SU/Lardi-Trans → v2 EXT-01/02
- Negotiation engine, ADR-specific tools, manager-override tool → Phase 4+
- Real-time WS push of FSM transitions → Phase 4
- fastText model bundle → keep deferred (lazy or Anthropic-based for demo)
