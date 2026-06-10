# Phase 04 Deferred Items

Items discovered during execution that are out-of-scope for the current plan
(per SCOPE BOUNDARY: only auto-fix issues DIRECTLY caused by the current task's
changes). These are tracked for future polish.


## Plan 04-06 (UAT gate) — deferred

### Pre-existing Biome errors in Zenith vendor files (319 errors / 40 warnings)

- **Source:** Zenith template vendored verbatim in Plan 04-01 (mahooo0/next-shadcn-admin-dashboard SHA 4e667cc).
- **Nature:** Mostly double-quote → single-quote formatter complaints across `apps/web/src/app/(main)/auth/_components/`, `apps/web/src/app/(main)/dashboard/{analytics,kanban,calendar,mail,crm,finance,productivity,components,draggable,coming-soon,(legacy)}/_components/`, plus `apps/web/postcss.config.mjs`, `apps/web/next-env.d.ts`, etc.
- **Decision:** Preserve Zenith vendor contract per Plan 04-05's documented decision (auto-fix would break upstream parity + bloat re-vendor diffs).
- **Verification status:** Pre-existing — confirmed via `git stash && pnpm exec biome check` on baseline (errors present before Plan 04-06 began).
- **Resolution path:** v2 cleanup pass after Phase 6 polish, or add `apps/web/src/app/(main)/(legacy)` + Zenith vendor paths to `biome.json` ignore list (preferred — keeps lint signal clean for our code).

