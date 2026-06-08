# State: AI-Логист

**Last updated:** 2026-06-08

## Project Reference

**Core value:** Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код — цена и подбор должны быть предсказуемыми, тестируемыми, воспроизводимыми.

**Current focus:** Phase 1 — Database + Backend Skeleton (foundation; PostGIS correctness is the bedrock that gates every downstream phase)

**Stack (locked):** Node 22 LTS + TypeScript 5.7 strict + Fastify 5 + Drizzle ORM 0.45.2 + PostgreSQL 17 + PostGIS 3.5 + Redis 7.4 + grammY 1.43 + Anthropic SDK 0.102 (betaZodTool) + Next.js 16 / React 19 / Tailwind v4 / shadcn/ui (Zenith Admin template) + Leaflet + OSM. Monorepo via pnpm workspaces. Deploy: docker-compose + Caddy on single VM.

## Current Position

**Phase:** 1 of 6 (Database + Backend Skeleton)
**Plan:** none (planning not yet started)
**Status:** Roadmap created, awaiting `/gsd:plan-phase 1`

**Progress:**
```
[░░░░░░░░░░░░░░░░░░░░] 0/6 phases complete
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 Requirements | 89 enumerated, 89 mapped (100% coverage) |
| Phases | 6 |
| Granularity | standard |
| Parallelization | Phase 4 parallelizable with Phase 3 after P2 contracts |
| High-risk phases | Phase 2, Phase 5 (per PITFALLS.md) |

## Accumulated Context

### Key Decisions

- **Stack fixed** (Node 22 + Fastify + Drizzle + PostGIS + grammY + Anthropic SDK + Next.js 16 / Zenith template) per PROJECT.md Key Decisions table — research converged unambiguously.
- **Modular monolith** in `apps/api` with 11 internal modules; cross-module talk only through public exports.
- **LLM tool sandwich** — every business action is a registered tool with JSON Schema + Zod sandwich; the LLM cannot mutate state except through validated tools; prices are rendered from `leads.quoted_price` via templated strings, never paraphrased.
- **PostGIS CTE re-rank** is mandatory for `nearestTruck`: overfetch 20 by `<->` (sphere, GiST-accelerated), re-rank by `ST_Distance(geog, true)` (spheroid). KNN sphere ≠ ST_Distance spheroid is a documented PostGIS gotcha (ticket #3127).
- **Telegram idempotency** on `update_id` is a non-negotiable Phase 3 invariant.
- **Demo-credibility additions** (beyond spec §9) merged into v1 from FEATURES research: public tracking link `/track/[token]`, TTN/CMR PDF stub, driver-confirmation loop, extended cargo fields, price-override audit, POD section, global search.

### TODOs

- Decide TTN/CMR template fidelity for demo (real RU legal form vs stylized PDF) — flagged in SUMMARY.md gaps; address during Phase 4 planning.
- Decide driver delivery mechanism for demo (real Telegram for one demo-driver vs simulator-only) — address during Phase 3 planning.
- Decide counterparty verification scope (mock badge only vs wire Opendatabot for UA EDRPOU) — likely defer to v2; verify during Phase 4 planning.
- Confirm pricing config seed values (`rate_per_km`, `dir_coef`, `season_coef` realistic ranges for RU↔UA market) — Phase 1 seed task.

### Blockers

- None.

### Notes

- REQUIREMENTS.md Coverage section states "**97 total**" but enumerated requirements sum to **89**. Treating 89 as canonical; updated traceability accordingly. See ROADMAP.md "Coverage Note" for detail.
- Phase 2 and Phase 5 are risk-weighted per PITFALLS.md. Phase 2 absorbs 5+ critical pitfalls (LLM in money path, KNN sphere/spheroid, FSM races, bilingual detection, prompt injection, token-cost runaway). Phase 5 absorbs the WS-reconnect/teleport cluster and the fake-looking-GPS risk.
- Voice channel is explicitly OUT of v1 demo (spec §5.2). POLISH-02 "simulate inbound call" button + POLISH-03 pre-recorded video absorb buyer pressure on voice.
- Tracking and admin-tracking page is split across Phase 4 (admin scaffold for `/dashboard/tracking`) and Phase 5 (live WS + simulator + geofence wiring) — both required for the visual demo moment.

## Session Continuity

**Next action:** Run `/gsd:plan-phase 1` to decompose Phase 1 (Database + Backend Skeleton) into executable plans.

**To resume after compaction:** Read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and this `STATE.md`. Stack is locked; phases 1-6 are derived from requirements with 100% coverage; Phase 1 is next.

---
*State initialized: 2026-06-08 after roadmap creation*
