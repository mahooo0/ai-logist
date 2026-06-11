// apps/api/src/lib/llm/openai-adapter.ts
//
// Phase 5 POLISH-06 — OpenAI adapter wrapping openai@4.104.0 (EXACT pin).
//
// KEY DIFFERENCE FROM AnthropicAdapter (Pitfall §5 — CRITICAL):
//   OpenAI's chat.completions.create returns `tool_calls[].function.arguments`
//   as a JSON STRING (not a parsed object). The mapper MUST call JSON.parse
//   with a try/catch — a malformed string would otherwise silently produce
//   undefined/garbage args and break the downstream Zod validation.
//
// Both adapters consume the SAME Phase 2 tool registry — Anti-Pitfall #1
// invariant is preserved: prices are rendered from leads.quoted_price (DB
// column), NOT from anything the LLM emits. Switching LLM_PROVIDER does NOT
// affect that boundary.

import OpenAI from 'openai';
import { config } from '../../config.js';
import type { LlmProvider } from './provider.js';

export class OpenAIAdapter implements LlmProvider {
  // Public for test stub access — tests do `(adapter as any).client.chat.completions.create = vi.fn()`.
  public readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model ?? config.OPENAI_MODEL ?? 'gpt-4o';
  }

  async runTurn(
    args: Parameters<LlmProvider['runTurn']>[0]
  ): Promise<Awaited<ReturnType<LlmProvider['runTurn']>>> {
    // Build OpenAI chat messages. System prompt is collapsed to a system
    // message in front; user/assistant history follows.
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: args.systemPrompt },
      ...args.userMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await this.client.chat.completions.create({
      model: this.model,
      // biome-ignore lint/suspicious/noExplicitAny: SDK message union is overly noisy; runtime shape matches.
      messages: messages as any,
      // Phase 5 keeps the request shape minimal: production flows always use
      // betaZodTool / Phase 2 tool registry via the existing pipeline; the
      // adapter exposes only the no-tool messages path the LlmProvider mock
      // covers, plus the function-call mapping below for the parity tests.
    });

    const msg = completion.choices[0]?.message;
    if (!msg) {
      throw new Error('OpenAI: empty choices in response');
    }

    // CRITICAL per Pitfall §5 — OpenAI returns function.arguments as a JSON
    // STRING. Parse with try/catch; throw a descriptive error on failure so
    // upstream callers know the boundary failed (rather than silently producing
    // undefined args that would slip past Zod validation).
    const rawToolCalls = msg.tool_calls ?? [];
    const toolCalls = rawToolCalls.map((tc) => {
      if (tc.type !== 'function') {
        throw new Error(`OpenAI: unsupported tool_call type: ${tc.type}`);
      }
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        throw new Error(
          `OpenAI tool args not valid JSON for tool=${tc.function.name}: ${tc.function.arguments}`
        );
      }
      return { name: tc.function.name, args: parsedArgs };
    });

    return {
      toolCalls,
      finalText: msg.content ?? null,
      usage: {
        input_tokens: completion.usage?.prompt_tokens ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  }
}
