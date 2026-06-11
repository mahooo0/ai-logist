// apps/api/src/lib/llm/anthropic-adapter.ts
//
// Phase 5 POLISH-06 — Anthropic adapter wrapping @anthropic-ai/sdk.
//
// Mirrors the Phase 2 AnthropicLlmClient (apps/api/src/pipeline/llm-client.ts)
// shape but lives under lib/llm/ so the provider factory can swap it with
// OpenAIAdapter without dragging in the rest of the pipeline.
//
// Critical distinction from OpenAIAdapter:
//   Anthropic `tool_use` blocks expose `input` as an ALREADY-PARSED object —
//   no JSON.parse needed. OpenAI's `function.arguments` is a JSON STRING.
//   See openai-adapter.ts for the Pitfall §5 mitigation.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import type { LlmProvider } from './provider.js';

export class AnthropicAdapter implements LlmProvider {
  // Public for test stub access — tests do `(adapter as any).client.messages.create = vi.fn()`.
  public readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? config.LLM_MODEL;
  }

  async runTurn(
    args: Parameters<LlmProvider['runTurn']>[0]
  ): Promise<Awaited<ReturnType<LlmProvider['runTurn']>>> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: args.systemPrompt,
      messages: args.userMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    const toolCalls: Array<{ name: string; args: unknown }> = [];
    let finalText: string | null = null;
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        // Anthropic: `input` is the already-parsed object (NOT a JSON string).
        // No JSON.parse needed — this is the SDK contract.
        toolCalls.push({ name: block.name, args: block.input });
      } else if (block.type === 'text') {
        finalText = block.text;
      }
    }

    return {
      toolCalls,
      finalText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }
}
