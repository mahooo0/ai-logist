// apps/api/tests/_helpers/mock-anthropic.ts
// CONTEXT specifics — interface shared by production adapter + test mock.
// Source: 02-RESEARCH.md §11 (verbatim with Node 22 ESM JSON import attribute).
//
// Production adapter (Wave 1, apps/api/src/pipeline/llm-client.ts) delegates to
// client.beta.messages.toolRunner and MUST implement the LlmProvider interface below.
// MockAnthropicClient reads from fixtures keyed by (tool_names, sha256_prefix(system + last_user)).

import { createHash } from 'node:crypto';
import fixtures from '../fixtures/llm-responses.json' with { type: 'json' };

export interface LlmProvider {
  runTurn(args: {
    systemPrompt: string;
    userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    toolNames: string[];
  }): Promise<{
    toolCalls: Array<{ name: string; args: unknown }>;
    finalText: string | null;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

type LlmResponseFixture = Awaited<ReturnType<LlmProvider['runTurn']>>;

export class MockAnthropicClient implements LlmProvider {
  private readonly responses: Record<string, LlmResponseFixture>;

  constructor(responses?: Record<string, LlmResponseFixture>) {
    // Cast required because JSON-imported object is typed as a generic record.
    this.responses = responses ?? (fixtures as unknown as Record<string, LlmResponseFixture>);
  }

  async runTurn(args: Parameters<LlmProvider['runTurn']>[0]): Promise<LlmResponseFixture> {
    const lastUser = args.userMessages.at(-1)?.content ?? '';
    const key = `${args.toolNames.join(',')}::${hashPrompt(args.systemPrompt, lastUser)}`;
    const hit = this.responses[key];
    if (!hit) {
      throw new Error(
        `MockAnthropicClient: no fixture for key="${key}". ` +
          'Add to apps/api/tests/fixtures/llm-responses.json or update the prompt. ' +
          `(toolNames=${JSON.stringify(args.toolNames)}, lastUser="${lastUser.slice(0, 80)}")`
      );
    }
    return hit;
  }
}

/**
 * Deterministic key derivation: sha256 of (systemPrompt + '\n---\n' + lastUserMessage),
 * first 16 hex chars. Mirrors the convention production adapter MUST follow when seeding
 * the fixture file (Wave 2 plans append entries via a small CLI helper or by hand).
 */
function hashPrompt(systemPrompt: string, lastUser: string): string {
  return createHash('sha256')
    .update(systemPrompt)
    .update('\n---\n')
    .update(lastUser)
    .digest('hex')
    .slice(0, 16);
}
