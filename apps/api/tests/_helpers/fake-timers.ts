// apps/api/tests/_helpers/fake-timers.ts
// Centralized fake-timer preset per 02-VALIDATION.md "Wave 0 Requirements".
//
// Loaded via vitest.config.ts setupFiles for the `unit` project so every unit test sees
// the same fixed wall clock. Snapshot stability depends on Date.now() being deterministic
// across runs (RESEARCH.md Pitfall #7).
//
// FIXED_NOW is exported so tests can compare Date.now() to it where needed.
//
// Also pre-populates the env vars required by config.ts Zod validation so unit tests can
// import production modules (which transitively load config.ts) without DATABASE_URL set.
// Plan 02-01 — production libs (routing, geocoding) import from config.ts.

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?sslmode=disable';
process.env.REDIS_URL ??= 'redis://localhost:6379';

import { afterEach, beforeEach, vi } from 'vitest';

export const FIXED_NOW = new Date('2026-06-09T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({
    now: FIXED_NOW,
    toFake: ['Date', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});
