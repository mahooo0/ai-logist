// Phase 2 Plan 02-01 Task 3 — Anthropic LLM client wrapper.
// CONTEXT D-01, D-02, D-36 — Anthropic Claude via betaZodTool + toolRunner.
//
// Implements the SAME LlmProvider interface as tests/_helpers/mock-anthropic.ts
// so the production code path and the test mock are swappable at the call site.
// Wave 2 tool registry (apps/api/src/pipeline/llm-tools/*) uses runToolLoop;
// Wave 3 intake.ts (or the equivalent) increments leads.tokens_in/tokens_out/llm_calls
// atomically from the `usage` field per D-36 (Pitfall #12 token-cost runaway).

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/**
 * Anthropic tool definition matching ExtractRequestSchema (D-09 verbatim).
 * Lives here — not built from the Zod schema — because the Zod schema uses
 * z.bigint() (budget_kopecks) which has no JSON-Schema representation. We keep
 * the JSON-Schema shape byte-faithful to the Zod schema; runtime parsing in
 * intake.ts re-validates with ExtractRequestSchema.strict().
 */
type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
};

const EXTRACT_REQUEST_JSON_SCHEMA: AnthropicToolDef['input_schema'] = {
  type: 'object',
  properties: {
    from_city: { type: ['string', 'null'], minLength: 2 },
    to_city: { type: ['string', 'null'], minLength: 2 },
    tons: { type: ['number', 'null'], exclusiveMinimum: 0 },
    body_type: { type: ['string', 'null'], enum: ['tent', 'ref', 'iso', 'container', null] },
    budget_kopecks: { type: ['integer', 'null'] },
    deadline_iso: { type: ['string', 'null'] },
    confidence: {
      type: 'object',
      properties: {
        from_city: { type: 'number', minimum: 0, maximum: 1 },
        to_city: { type: 'number', minimum: 0, maximum: 1 },
        tons: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['from_city', 'to_city', 'tons'],
    },
    clarifying_question_ru: { type: ['string', 'null'] },
    clarifying_question_ua: { type: ['string', 'null'] },
  },
  required: [
    'from_city',
    'to_city',
    'tons',
    'body_type',
    'budget_kopecks',
    'deadline_iso',
    'confidence',
    'clarifying_question_ru',
    'clarifying_question_ua',
  ],
};

const TOOL_REGISTRY: Record<string, AnthropicToolDef> = {
  extractRequest: {
    name: 'extractRequest',
    description:
      'Extract a logistics request from the client message. Return strict JSON with confidence per critical field. Use null for unrecognized fields. NEVER quote prices.',
    input_schema: EXTRACT_REQUEST_JSON_SCHEMA,
  },
};

/**
 * Production / test contract for any module the pipeline can swap. Must stay
 * byte-identical to tests/_helpers/mock-anthropic.ts. Wave 4 may refactor both into
 * a shared types module; for Wave 1 we keep parallel definitions to avoid the
 * cross-package import gymnastics in tests/.
 */
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

/**
 * Anthropic-backed production LlmProvider. Tests use MockAnthropicClient instead
 * (see apps/api/tests/_helpers/mock-anthropic.ts).
 *
 * NOTE: this thin wrapper only exposes the no-tool messages path so the
 * `LlmProvider` mock can key fixtures by tool name. Full tool-execution loops
 * are handled by `runToolLoop` below (Wave 3 intake.ts plumbing).
 */
export class AnthropicLlmClient implements LlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? config.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AnthropicLlmClient requires ANTHROPIC_API_KEY. Tests should inject MockAnthropicClient.'
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = opts?.model ?? config.LLM_MODEL;
  }

  async runTurn(
    args: Parameters<LlmProvider['runTurn']>[0]
  ): Promise<Awaited<ReturnType<LlmProvider['runTurn']>>> {
    // Resolve tool names to Anthropic tool definitions via the in-process
    // registry. Without this Claude has nothing to call and the pipeline's
    // extractRequest path falls through to "missing_tool_call" every turn.
    const tools = args.toolNames
      .map((name) => TOOL_REGISTRY[name])
      .filter((t): t is AnthropicToolDef => t !== undefined);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: args.systemPrompt,
      messages: args.userMessages.map((m) => ({ role: m.role, content: m.content })),
      ...(tools.length > 0 && { tools, tool_choice: { type: 'any' as const } }),
    });

    const toolCalls = response.content
      .filter((b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use')
      .map((block) => {
        // Zod schema treats budget_kopecks as bigint (D-09); JSON-Schema can only
        // express it as integer. Coerce so ExtractRequestSchema.strict() accepts it.
        let normalized: unknown = block.input;
        if (
          normalized !== null &&
          typeof normalized === 'object' &&
          'budget_kopecks' in normalized &&
          typeof (normalized as { budget_kopecks: unknown }).budget_kopecks === 'number'
        ) {
          normalized = {
            ...(normalized as Record<string, unknown>),
            budget_kopecks: BigInt(
              (normalized as { budget_kopecks: number }).budget_kopecks
            ),
          };
        }
        return { name: block.name, args: normalized };
      });

    const textBlock = response.content.find((b) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    return {
      toolCalls,
      finalText: textBlock?.text ?? null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }
}

/**
 * Helper for Wave 3 intake: run a full tool-execution loop. Tools come from
 * buildToolRegistry(ctx) (Wave 2). `usage` is returned so the caller increments
 * `leads.tokens_in / tokens_out / llm_calls` atomically per D-36.
 *
 * The tools array element type uses the SDK's betaZodTool return type. We do
 * NOT re-export betaZodTool here — Wave 2 tool files import it directly from
 * `@anthropic-ai/sdk/helpers/beta/zod` to keep the dependency surface honest.
 */
export async function runToolLoop(args: {
  apiKey?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Wave 2 will narrow this type once tools land. Using `unknown[]` keeps the
  // helper buildable in Wave 1 without forward-referencing Wave 2 file shapes.
  tools: unknown[];
  maxIterations?: number;
  model?: string;
}): Promise<{ usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = args.apiKey ?? config.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'runToolLoop requires ANTHROPIC_API_KEY. Tests should mock at the pipeline boundary instead.'
    );
  }
  const client = new Anthropic({ apiKey });
  // Bridge cast: SDK helper typings for tools live in @anthropic-ai/sdk/helpers/beta/zod
  // and unify at the toolRunner boundary. Wave 2 tightens this type once the registry exists.
  const runner = client.beta.messages.toolRunner({
    model: args.model ?? config.LLM_MODEL,
    max_tokens: 1024,
    system: args.systemPrompt,
    messages: args.messages as never,
    tools: args.tools as never,
    max_iterations: args.maxIterations ?? 6,
  });
  const finalMessage = await runner;
  return {
    usage: {
      input_tokens: finalMessage.usage?.input_tokens ?? 0,
      output_tokens: finalMessage.usage?.output_tokens ?? 0,
    },
  };
}
