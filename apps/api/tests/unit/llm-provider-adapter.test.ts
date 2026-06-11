import { describe, test } from 'vitest';

// POLISH-06 scaffold — Wave 4 (Plan 05-04) flips the pending marker to it()
// blocks asserting AnthropicAdapter + OpenAIAdapter return the same
// LlmProvider shape (toolCalls[], finalText, usage) for the same mocked
// input. Confirms tool-registry compatibility per D-45 (CONTEXT) and the
// anti-Pitfall #1 invariant — both adapters render prices from
// leads.quoted_price (templated), never paraphrase the LLM output.
describe('POLISH-06: LLM provider adapter parity', () => {
  test.todo(
    'AnthropicAdapter + OpenAIAdapter return same LlmProvider shape for same mocked input'
  );
});
