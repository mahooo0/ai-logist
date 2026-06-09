// Phase 2 Plan 02-02 Task 1 — extractRequest tool (LOGIC-01, LOGIC-04, LOGIC-05).
//
// Sources:
//   - CONTEXT D-04..D-13, D-42, D-43.
//   - 02-RESEARCH.md §2 (ExtractRequestSchema VERBATIM, D-09 byte-exact),
//     §3 (system prompt + 5 few-shots), "Pattern 2" (tool file shape), "Pattern 3" (envelope).
//
// Key invariants:
//   - The schema matches D-09 exactly: from_city/to_city/tons/body_type/budget_kopecks/
//     deadline_iso/confidence.{from_city,to_city,tons}/clarifying_question_ru/clarifying_question_ua.
//   - body_type enum ['tent','ref','iso','container'] only.
//   - Strict-mode rejection of unknown fields (LOGIC-05).
//   - Handler wraps the client text in `<client_message>...</client_message>` so
//     prompt-injection attempts inside the user payload cannot be interpreted as
//     directives (Pitfall #11, D-42).
//   - Belt-and-suspenders: `ExtractRequestSchema.strict().parse(...)` ALSO runs in the
//     handler, regardless of what the SDK / JSON-Schema strict mode did upstream (D-05).

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { LlmProvider } from '../llm-client.js';
import { EXTRACT_REQUEST_SYSTEM_PROMPT } from './extract-request.prompt.js';
import type { ToolContext } from './index.js';

/** D-09 VERBATIM. Do not add fields without a CONTEXT decision. */
export const ExtractRequestSchema = z.object({
  from_city: z.string().min(2).nullable(),
  to_city: z.string().min(2).nullable(),
  tons: z.number().positive().nullable(),
  body_type: z.enum(['tent', 'ref', 'iso', 'container']).nullable(),
  budget_kopecks: z.bigint().nullable(),
  deadline_iso: z.string().datetime().nullable(),
  confidence: z.object({
    from_city: z.number().min(0).max(1),
    to_city: z.number().min(0).max(1),
    tons: z.number().min(0).max(1),
  }),
  clarifying_question_ru: z.string().nullable(),
  clarifying_question_ua: z.string().nullable(),
});

export type ExtractRequestOutput = z.infer<typeof ExtractRequestSchema>;

/**
 * Thrown when the model's tool-call args (or its final text) fail Zod parsing in
 * `extractRequestHandler`. The pipeline (Wave 3) catches this and uses LOGIC-04's
 * clarification-budget counter to decide whether to retry or escalate.
 */
export class ExtractRequestParseError extends Error {
  readonly code = 'extract_request_parse_error' as const;
  constructor(
    message: string,
    readonly zodIssues?: unknown
  ) {
    super(message);
    this.name = 'ExtractRequestParseError';
  }
}

/**
 * Direct call surface for unit / integration tests. Bypasses the full betaZodTool
 * loop (which the production pipeline uses through `runToolLoop`) and instead invokes
 * the `LlmProvider.runTurn` boundary the MockAnthropicClient already implements.
 *
 * Returns the parsed `ExtractRequestOutput`. Throws `ExtractRequestParseError` on
 * Zod failure.
 */
export async function extractRequestHandler(args: {
  llm: LlmProvider;
  ctx: ToolContext;
  text: string;
}): Promise<ExtractRequestOutput> {
  const wrapped = `<client_message>${args.text}</client_message>`;
  const result = await args.llm.runTurn({
    systemPrompt: EXTRACT_REQUEST_SYSTEM_PROMPT,
    userMessages: [{ role: 'user', content: wrapped }],
    toolNames: ['extractRequest'],
  });
  // Mock returns the args directly via toolCalls; production wires `runToolLoop`
  // separately and populates `toolCalls` from `tool_use` blocks.
  const call = result.toolCalls.find((c) => c.name === 'extractRequest');
  const raw = call?.args ?? result.finalText;
  const parseResult = ExtractRequestSchema.strict().safeParse(raw);
  if (!parseResult.success) {
    args.ctx.log.warn(
      { tool: 'extractRequest', leadId: args.ctx.leadId, issues: parseResult.error.issues },
      'extractRequest.parse_failed'
    );
    throw new ExtractRequestParseError(
      'extractRequest tool result failed Zod strict parse',
      parseResult.error.issues
    );
  }
  args.ctx.log.info(
    { tool: 'extractRequest', leadId: args.ctx.leadId, parsed: parseResult.data },
    'tool.invoked'
  );
  return parseResult.data;
}

/**
 * betaZodTool registration. The production pipeline (Wave 3) places this into the
 * registry array passed to `client.beta.messages.toolRunner`. The `run` callback is
 * what the SDK invokes when Claude emits a `tool_use` block; it re-validates the
 * input under D-05 (trust nothing from the model) and persists the extraction so
 * that downstream `nearestTruck` / `calcPrice` calls in the same turn read the lead
 * row, not the LLM's in-memory state.
 *
 * Wave 2 ships only the schema + run callback. Wave 3 wires the actual lead row
 * mutation (storing extracted fields, advancing the FSM if confidence is high
 * enough). For Wave 2 we return the parsed extract back to the model as a JSON
 * envelope so the model can decide whether to ask a clarifying question.
 */
export function extractRequestTool(ctx: ToolContext) {
  return betaZodTool({
    name: 'extractRequest',
    description:
      'Extract a logistics request from the client message. Return strict JSON with confidence per critical field. Use null for unrecognized fields. NEVER quote prices.',
    inputSchema: ExtractRequestSchema,
    run: async (input) => {
      // Belt-and-suspenders re-validation per D-05.
      const validated = ExtractRequestSchema.strict().parse(input);
      ctx.log.info(
        { tool: 'extractRequest', leadId: ctx.leadId, input: validated },
        'tool.invoked'
      );
      return JSON.stringify({
        ok: true,
        data: {
          from_city: validated.from_city,
          to_city: validated.to_city,
          tons: validated.tons,
          body_type: validated.body_type,
          // bigint is not JSON-serialisable; stringify defensively.
          budget_kopecks:
            validated.budget_kopecks === null ? null : validated.budget_kopecks.toString(),
          deadline_iso: validated.deadline_iso,
          confidence: validated.confidence,
          clarifying_question_ru: validated.clarifying_question_ru,
          clarifying_question_ua: validated.clarifying_question_ua,
        },
      });
    },
  });
}
