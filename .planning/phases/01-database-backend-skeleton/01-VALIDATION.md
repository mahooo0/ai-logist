---
phase: 1
slug: database-backend-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (Node-native, ESM-first, fast — matches monorepo) |
| **Config file** | `apps/api/vitest.config.ts` (created in Wave 0) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit` |
| **Full suite command** | `pnpm test` (root — runs api unit + integration + smoke) |
| **Estimated runtime** | ~15-25s (Wave 0 stubs); ~30-60s at end of Phase 1 (DB integration tests) |

Auxiliary commands:
- `pnpm --filter @ai-logist/api typecheck` — `tsc --noEmit`
- `pnpm exec biome check .` — lint + format
- `pnpm db:migrate:check` — verify migrations are deterministic (re-run produces no diff)
- `pnpm seed` — must be idempotent (`ON CONFLICT DO NOTHING`)
- `docker compose up -d postgres redis && curl http://localhost:3000/api/health` — smoke

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-logist/api typecheck` + `pnpm exec biome check <changed-files>`
- **After every plan wave:** Run `pnpm test` (full suite) + `pnpm db:migrate:check`
- **Before `/gsd:verify-work`:** Full suite must be green, `docker compose up` must boot to `/api/health` 200
- **Max feedback latency:** 30 seconds for typecheck + unit; 90 seconds for full integration

---

## Per-Task Verification Map

(Filled when planner produces PLAN.md task IDs. Placeholder layout below — planner is responsible for replacing each row with concrete task references.)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-W0-01 | 00 | 0 | infra | bootstrap | `pnpm install && pnpm exec vitest --version` | ❌ W0 | ⬜ pending |
| 1-W0-02 | 00 | 0 | infra | bootstrap | `test -f apps/api/vitest.config.ts` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | DEPLOY-01,03 | smoke | `docker compose config -q` (validate) | ❌ W0 | ⬜ pending |
| 1-02-XX | 02 | 2 | DB-01..09 | unit+integration | `pnpm --filter @ai-logist/api test:db` | ❌ W0 | ⬜ pending |
| 1-03-XX | 03 | 3 | API-01,16 | integration | `pnpm --filter @ai-logist/api test:health` | ❌ W0 | ⬜ pending |
| 1-04-XX | 04 | 4 | DB-10 | smoke | `pnpm seed && pnpm seed` (idempotent) + KNN print | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 sets up the test infrastructure BEFORE any production code is written. All items must be true before Wave 1 starts.

- [ ] **`apps/api/vitest.config.ts`** — Vitest config with `environment: 'node'`, globals enabled, `testTimeout: 15000`, projects split into `unit` / `integration` / `smoke`
- [ ] **`apps/api/tests/conftest.ts`** — Shared test fixtures (PG container connection helper, db cleanup between tests)
- [ ] **`apps/api/tests/unit/.gitkeep`** — Unit test directory
- [ ] **`apps/api/tests/integration/.gitkeep`** — Integration test directory (uses real PG via testcontainers OR shared dev DB)
- [ ] **`apps/api/tests/smoke/.gitkeep`** — Smoke test directory
- [ ] **Vitest + @testcontainers/postgresql installed** — `pnpm add -D vitest @vitest/coverage-v8 @testcontainers/postgresql @types/node` in `apps/api`
- [ ] **`pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:smoke` scripts in root + apps/api package.json**
- [ ] **Empty stub tests for every Phase 1 acceptance criterion** — one stub per task in `tests/unit/phase-1-stubs.test.ts` with `test.todo(...)` markers so coverage tracking sees them as MISSING (red) until the producing task fills them
- [ ] **Biome check passes on empty fixture files** — `pnpm exec biome check apps/api/tests/`
- [ ] **CI guard** — Wave 0 commit must include a `tests/README.md` documenting how to run each test category

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README "10-minute fresh-developer setup" | DEPLOY-04 | Time-on-machine measurement requires a human stopwatch on a clean macOS/Linux box | Spin up a fresh DevContainer or VM, follow README from top to bottom, time start of `pnpm install` to first successful `curl /api/health 200`. Must be ≤10 min. |
| Swagger UI rendering | API-16 | Visual confirmation of `/api/docs` is human-only | Run `pnpm dev`, open `http://localhost:3000/api/docs`, confirm every API-* endpoint is listed with its Zod schema, even the 501 stubs |
| Canonical KNN smoke output | DB-10 | Confirms seed produced spatially-plausible data | After `pnpm seed`, output must include a "KNN from Kyiv → Truck A 42km, Truck B 88km, Truck C 137km" block; human eyeballs that distances are in a believable range and trucks differ |
| Docker compose on a clean VPS | DEPLOY-01,02 | Production-like environment validation | On a fresh Hetzner/DO VM with Docker installed, run the documented deploy script; `curl https://<domain>/api/health` returns 200 with TLS valid |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command OR explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks lack automated verification (Wave 0 stubs guarantee this)
- [ ] Wave 0 covers every MISSING reference flagged in the Per-Task table
- [ ] No watch-mode flags in CI commands (`--run` is implicit in `pnpm test` via package.json scripts)
- [ ] Feedback latency: typecheck <30s, unit <30s, full suite <90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner has filled the Per-Task table and Wave 0 is green

**Approval:** pending

---

## Notes for Planner

- **MUST produce 1 Wave 0 plan** that ships test infrastructure before any production code in Wave 1+
- **MUST tag every task with `<automated_check>`** referencing a command from this strategy
- **For Drizzle schema tasks:** the integration test is `db:migrate:check` (re-run migrations, expect zero diff) — use this as the automated verify
- **For Fastify routes:** integration test via Supertest hitting the Fastify instance directly (no docker needed); only `/api/health` needs the docker smoke
- **For docker-compose:** verify by `docker compose config -q` (yaml valid) + a separate smoke that boots `postgres` only and runs migrations against it
