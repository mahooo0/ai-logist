// apps/api/tests/unit/llm-provider-adapter.test.ts
//
// POLISH-06 — Wave 4 (Plan 05-04). LLM provider adapter parity.
//
// Verifies:
//   - AnthropicAdapter implements LlmProvider (returns toolCalls + finalText + usage)
//   - OpenAIAdapter implements LlmProvider (same shape)
//   - OpenAI mapper calls JSON.parse on function.arguments (Pitfall §5)
//   - OpenAI mapper throws descriptive error if function.arguments is not valid JSON
//   - Anthropic block.input is consumed directly (already parsed object)
//   - getLLMClient() returns AnthropicAdapter when LLM_PROVIDER unset / 'anthropic'
//   - Singleton behaviour — _resetLLMClientForTesting() releases the cache

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicAdapter } from '../../src/lib/llm/anthropic-adapter.js';
import { OpenAIAdapter } from '../../src/lib/llm/openai-adapter.js';
import { _resetLLMClientForTesting, getLLMClient } from '../../src/lib/llm/provider.js';

describe('POLISH-06: LLM provider adapter parity', () => {
  beforeEach(() => {
    _resetLLMClientForTesting();
  });

  it('AnthropicAdapter implements LlmProvider (has runTurn method)', () => {
    const adapter = new AnthropicAdapter('test-key');
    expect(typeof adapter.runTurn).toBe('function');
  });

  it('OpenAIAdapter implements LlmProvider (has runTurn method)', () => {
    const adapter = new OpenAIAdapter('test-key');
    expect(typeof adapter.runTurn).toBe('function');
  });

  it('OpenAI mapper: function.arguments JSON-string is parsed into object (Pitfall §5)', async () => {
    const adapter = new OpenAIAdapter('test-key');
    // biome-ignore lint/suspicious/noExplicitAny: stub override of vendored OpenAI client
    (adapter as any).client.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'tc_1',
                type: 'function',
                function: {
                  name: 'extractRequest',
                  arguments: '{"from_city":"Киев","to_city":"Львов","tons":18}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });
    const result = await adapter.runTurn({
      systemPrompt: '',
      userMessages: [],
      toolNames: ['extractRequest'],
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('extractRequest');
    expect(result.toolCalls[0]?.args).toEqual({
      from_city: 'Киев',
      to_city: 'Львов',
      tons: 18,
    });
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 20 });
  });

  it('OpenAI mapper: malformed JSON in function.arguments throws descriptive error', async () => {
    const adapter = new OpenAIAdapter('test-key');
    // biome-ignore lint/suspicious/noExplicitAny: stub override of vendored OpenAI client
    (adapter as any).client.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'tc_1',
                type: 'function',
                function: { name: 'extractRequest', arguments: 'NOT JSON' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    await expect(
      adapter.runTurn({ systemPrompt: '', userMessages: [], toolNames: [] })
    ).rejects.toThrow(/not valid JSON/);
  });

  it('Anthropic mapper: block.input is consumed directly (no JSON.parse needed)', async () => {
    const adapter = new AnthropicAdapter('test-key');
    // biome-ignore lint/suspicious/noExplicitAny: stub override of vendored Anthropic client
    (adapter as any).client.messages.create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'extractRequest',
          input: { from_city: 'Київ', to_city: 'Львів', tons: 18 },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    const result = await adapter.runTurn({
      systemPrompt: '',
      userMessages: [],
      toolNames: ['extractRequest'],
    });
    expect(result.toolCalls[0]?.args).toEqual({
      from_city: 'Київ',
      to_city: 'Львів',
      tons: 18,
    });
  });

  it('OpenAI mapper: text content with no tool_calls returns empty toolCalls + finalText', async () => {
    const adapter = new OpenAIAdapter('test-key');
    // biome-ignore lint/suspicious/noExplicitAny: stub override
    (adapter as any).client.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'hello world', tool_calls: undefined } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });
    const result = await adapter.runTurn({
      systemPrompt: 'system',
      userMessages: [{ role: 'user', content: 'hi' }],
      toolNames: [],
    });
    expect(result.toolCalls).toEqual([]);
    expect(result.finalText).toBe('hello world');
  });

  it('getLLMClient returns AnthropicAdapter when LLM_PROVIDER unset/anthropic', () => {
    // config.LLM_PROVIDER default is 'anthropic'; ANTHROPIC_API_KEY may be absent
    // in unit env, but AnthropicAdapter constructor only requires the key string.
    const client = getLLMClient();
    expect(client).toBeInstanceOf(AnthropicAdapter);
  });

  it('Singleton: repeated getLLMClient calls return identical instance', () => {
    const a = getLLMClient();
    const b = getLLMClient();
    expect(a).toBe(b);
  });

  it('_resetLLMClientForTesting clears the singleton', () => {
    const a = getLLMClient();
    _resetLLMClientForTesting();
    const b = getLLMClient();
    expect(a).not.toBe(b);
  });
});
