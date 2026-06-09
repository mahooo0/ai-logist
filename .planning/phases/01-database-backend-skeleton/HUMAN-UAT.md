# Phase 01 — Human UAT Backlog

Manual verifications that were **auto-approved** during `--auto` mode execution but still require a real human to actually run on a clean machine before Phase 1 can be marked "buyer-eval ready."

## Status legend

- ⏳ pending — auto-approved, awaiting real human pass
- ✅ verified — real human ran the steps and signed off
- ❌ failed — real human hit a blocker; needs follow-up plan

---

## UAT-01: 10-minute fresh-developer README walkthrough (Plan 01-10 checkpoint)

**Status:** ⏳ pending (auto-approved 2026-06-09 in --auto orchestrator mode)

**Why deferred:** Plan 01-10 ended with a `checkpoint:human-verify` task. Orchestrator was invoked with `--auto`, so the executor auto-approved per `<auto_mode_directive>`. The README path was verified statically (file content + grep + unit tests) but no real human has actually executed the 10-minute sequence on a clean machine yet.

**What needs to happen:**

1. Open the repo in a fresh terminal on a clean machine OR fresh DevContainer.
2. Confirm Node 22 (`node --version`) and pnpm 9 (`pnpm --version`).
3. Optional reset for repeat measurement:
   ```bash
   docker compose down -v   # destroys named volumes
   rm -rf node_modules apps/*/node_modules packages/*/node_modules pnpm-lock.yaml || true
   ```
   Note: do NOT delete `drizzle/0001*.sql` — README assumes it is committed.
4. Start a stopwatch.
5. Follow `README.md` "Local setup" steps verbatim:
   - `cp .env.example .env.local`
   - `docker compose up -d postgres redis`
   - `pnpm install`
   - `pnpm db:migrate`
   - `pnpm seed` — confirm "Canonical KNN smoke (pickup = Kyiv center)" is printed with 3 trucks
   - `pnpm dev` — leaves Fastify in foreground
6. In another terminal: `curl http://localhost:3000/api/health | jq`
   - Confirm `status: "ok"`, `checks.db: "ok"`, `checks.postgis ~ /3.5/`, `checks.redis: "ok"`
7. In a browser: `http://localhost:3000/api/docs` — confirm Swagger UI renders the full API contract.
8. Optional bonus: `docker compose up -d` (full stack), then `curl http://localhost/api/health` (through Caddy on :80) — same response.
9. Stop the stopwatch. **Goal: ≤10 min total.**

**Acceptance:** ✅ if a real human can follow README and reach `/api/health 200` within 10 minutes.

**Verifier checklist:**
- [ ] Elapsed time ≤ 10 minutes (measured second-pass with caches warm)
- [ ] `curl http://localhost:3000/api/health` returns 200 with `checks.postgis ~ /3.5/`
- [ ] `pnpm seed` printed "Canonical KNN smoke" with 3 trucks
- [ ] `http://localhost:3000/api/docs` Swagger UI renders
- [ ] No undocumented surprises (typos, missing steps, command failures)

**On failure:** Revise README + re-open Plan 01-10 as a hotfix plan with the specific gap.

---

*Last updated: 2026-06-09 (Plan 01-10 auto-approval).*
