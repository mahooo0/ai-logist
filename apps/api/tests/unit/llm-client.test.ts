// Phase 2 Plan 02-01 Task 3 — AnthropicLlmClient unit tests.
//
// Verifies:
//   - Constructor throws when no ANTHROPIC_API_KEY is configured (production safety).
//   - Constructor accepts an explicit key without throwing.
//   - The class implements the same LlmProvider interface as the test mock so
//     they are interchangeable at the call site.

import { describe, expect, it } from 'vitest';
import { AnthropicLlmClient, type LlmProvider } from '../../src/pipeline/llm-client.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';

describe('AnthropicLlmClient', () => {
  it('constructs without throwing when apiKey is provided explicitly', () => {
    expect(() => new AnthropicLlmClient({ apiKey: 'sk-test-key' })).not.toThrow();
  });

  it('throws a clear error when no apiKey is available', () => {
    // fake-timers setup populates DATABASE_URL/REDIS_URL but NOT ANTHROPIC_API_KEY.
    // If env wasn't set and no explicit key passed, the constructor must throw.
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => new AnthropicLlmClient()).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('AnthropicLlmClient and MockAnthropicClient both satisfy LlmProvider', () => {
    // Compile-time check via the type assertion: if either class diverges from
    // the LlmProvider contract, tsc will fail before this test even runs.
    const mock: LlmProvider = new MockAnthropicClient({});
    const prod: LlmProvider = new AnthropicLlmClient({ apiKey: 'sk-test' });
    // Smoke runtime: both expose .runTurn as a function.
    expect(typeof mock.runTurn).toBe('function');
    expect(typeof prod.runTurn).toBe('function');
  });
});
