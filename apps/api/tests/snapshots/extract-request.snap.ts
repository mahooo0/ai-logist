import { describe, test } from 'vitest';

// POLISH-01 scaffold — Wave 3 (Plan 05-03) flips the pending marker to it()
// blocks asserting each of 20 canonical-inputs.json entries produces a
// byte-stable snapshot via MockAnthropicClient (no live LLM calls). The
// snapshot files live under apps/api/tests/snapshots/__snapshots__/ and
// are committed to git. Stability gate: pnpm --filter @ai-logist/api
// test:snapshot loops 10 times — every run must be byte-identical.
describe('POLISH-01: extractRequest snapshot stability (20 canonical inputs)', () => {
  test.todo('Each canonical input produces byte-stable snapshot via MockAnthropicClient');
});
