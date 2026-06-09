# Deferred Items — Phase 01

## Lint errors in Wave 0 test files (out of scope for Plan 01-01)

`apps/api/tests/_helpers/test-db.ts` has two pre-existing lint errors that surfaced when Biome was installed in Plan 01-01:

1. **`apps/api/tests/_helpers/test-db.ts:11:25`** — `lint/style/noNonNullAssertion` — `if (container) return connectionUrl!;`
2. **`apps/api/tests/_helpers/test-db.ts:18:19`** — `lint/style/useTemplate` — string concat instead of template literal

Both are auto-fixable (`pnpm exec biome check --write apps/api/tests/_helpers/test-db.ts`). They are scoped to Wave 0 test infra (Plan 01-00) so we intentionally did not touch them in Plan 01-01. Defer fix to whoever next edits that file (likely Plan 01-04 or 01-07).
