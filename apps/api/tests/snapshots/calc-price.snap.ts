import { describe, test } from 'vitest';

// POLISH-01 scaffold — Wave 3 (Plan 05-03) flips the pending marker to it()
// blocks asserting each of 10 calcPrice combinations (distance × tons ×
// bodyType × direction) produces a byte-stable kopecks output via
// FIXED_CONFIG (pricing_config seed values) + FIXED_NOW (fake-timers
// preset). Pure-function snapshot — no DB or LLM dependencies.
describe('POLISH-01: calcPrice snapshot stability (10 combos)', () => {
  test.todo('Each combo produces byte-stable kopecks output via FIXED_CONFIG + FIXED_NOW');
});
