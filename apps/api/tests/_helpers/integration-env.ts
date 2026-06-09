// apps/api/tests/_helpers/integration-env.ts
//
// Loaded as setupFile for the `integration` vitest project (vitest.config.ts).
//
// Purpose: pre-populate DATABASE_URL + REDIS_URL with harmless localhost defaults
// BEFORE any test file's top-level `import` runs config.ts. Some production
// modules (e.g. apps/api/src/pipeline/intake.ts → config.LLM_TOKEN_BUDGET_PER_LEAD)
// are statically imported by dialog-harness.ts, which is itself statically
// imported by integration tests. Without these defaults config.ts's Zod parse
// fails and process.exit(1) kills the test process before describe.skipIf can
// short-circuit on Docker-less runners.
//
// Integration tests that actually need real DB / Redis URLs override these
// inside their beforeAll() via the testcontainers connection string.

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?sslmode=disable';
process.env.REDIS_URL ??= 'redis://localhost:6379';
