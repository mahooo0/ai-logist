// apps/api/src/lib/llm/provider.ts
//
// Phase 5 POLISH-06 — LLM provider factory + interface re-export.
//
// `getLLMClient()` returns a singleton implementing the Phase 2 LlmProvider
// contract. Selection is driven by `config.LLM_PROVIDER`:
//   - 'anthropic' (default) → AnthropicAdapter wrapping @anthropic-ai/sdk
//   - 'openai'              → OpenAIAdapter wrapping openai@4.104.0 (Pitfall §5)
//
// Both adapters consume the SAME Phase 2 tool registry
// (apps/api/src/pipeline/llm-tools/*) and emit identical Zod-validated output
// shapes — Anti-Pitfall #1 invariant: prices are rendered from
// leads.quoted_price (templated, not LLM-paraphrased) regardless of provider.

import { config } from '../../config.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';

/**
 * Production / test contract for any module the pipeline can swap.
 *
 * Stays byte-identical to:
 *   - apps/api/tests/_helpers/mock-anthropic.ts (Phase 2 test mock)
 *   - apps/api/src/pipeline/llm-client.ts (legacy Anthropic wrapper)
 *
 * Phase 5 deliberately re-declares the interface here (rather than re-exporting
 * from pipeline/llm-client.ts) so the `lib/llm/` module forms a clean
 * boundary independent of the older pipeline path.
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

let singleton: LlmProvider | null = null;

/**
 * Returns the singleton LlmProvider implementation chosen by `config.LLM_PROVIDER`.
 *
 * AnthropicAdapter accepts an empty key in unit tests — production callers that
 * actually hit the LLM API will fail at request time. OpenAIAdapter throws at
 * construction if OPENAI_API_KEY is absent (per CONTEXT D-44).
 */
export function getLLMClient(): LlmProvider {
  if (singleton) return singleton;
  if (config.LLM_PROVIDER === 'openai') {
    if (!config.OPENAI_API_KEY) {
      throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY to be set');
    }
    singleton = new OpenAIAdapter(config.OPENAI_API_KEY);
  } else {
    // Default Anthropic. Empty key tolerated here so unit tests can construct
    // the adapter without ANTHROPIC_API_KEY; runTurn() will fail if invoked
    // without a real key (SDK call throws).
    singleton = new AnthropicAdapter(config.ANTHROPIC_API_KEY ?? '');
  }
  return singleton;
}

/**
 * Test-only — clear the singleton between adapter tests so a fresh instance
 * can be re-constructed. NEVER call from production paths.
 */
export function _resetLLMClientForTesting(): void {
  singleton = null;
}
