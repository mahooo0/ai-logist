// Phase 2 Plan 02-02 Task 1 — LLM tool registry barrel + ToolContext type.
//
// Source: 02-RESEARCH.md "Pattern 1" (verbatim shape).
//
// Wave 3 intake.ts will create the ToolContext once per pipeline turn and pass it
// to `buildToolRegistry(ctx)` to obtain the array of betaZodTool registrations to
// hand to `client.beta.messages.toolRunner`. The mock equivalent — exercised by
// `extract-request.test.ts` — bypasses `toolRunner` entirely and calls the
// per-tool handler directly through the `LlmProvider.runTurn` boundary.

import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../../db.js';
import type { LlmProvider } from '../llm-client.js';
import { calcPriceTool } from './calc-price.js';
import { createOrderTool } from './create-order.js';
import { detectLanguageTool } from './detect-language.js';
import { discountTool } from './discount.js';
import { extractRequestTool } from './extract-request.js';
import { nearestTruckTool } from './nearest-truck.js';

/**
 * Shared per-turn context for every tool handler.
 *
 *   - `db` — the production NodePgDatabase or testcontainers equivalent.
 *   - `log` — Fastify's pino-flavoured logger; tool handlers MUST emit
 *     `tool.invoked` events for D-43 auditability.
 *   - `llm` — the LlmProvider whose mock implementation `extractRequestHandler`
 *     calls during unit tests. Production `runToolLoop` driver doesn't use this
 *     field directly (it constructs the runner itself), but downstream handlers
 *     that need a second LLM call (e.g. `detectLanguage` fallback in an
 *     ambiguous case) read it from here.
 *   - `leadId` / `clientId` — pinned for the turn; tool handlers use them to
 *     write to the correct row (and to look up `clients.lang` for sticky
 *     language detection per D-12).
 *   - `clientLang` — the sticky language hint sourced from `clients.lang` at
 *     turn start. Tools use it to choose RU vs UA copy.
 */
export interface ToolContext {
  db: Db;
  log: FastifyBaseLogger;
  llm: LlmProvider;
  leadId: string;
  clientId: string;
  clientLang: 'ru' | 'ua';
}

/**
 * Build the array of 6 betaZodTool registrations the LLM is allowed to call.
 *
 * Order is the canonical pipeline order — the LLM may call them in any order,
 * but a deterministic registration order keeps `tools` array diffs stable in
 * snapshot tests.
 */
export function buildToolRegistry(ctx: ToolContext) {
  return [
    extractRequestTool(ctx),
    nearestTruckTool(ctx),
    calcPriceTool(ctx),
    createOrderTool(ctx),
    discountTool(ctx),
    detectLanguageTool(ctx),
  ];
}
