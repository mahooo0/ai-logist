// Phase 2 Plan 02-02 Task 1 — detectLanguage tool.
//
// CONTEXT D-12..D-15. Wraps the Wave 1 Cyrillic-script heuristic
// (apps/api/src/lib/lang-detect.ts) and exposes it as a betaZodTool so the model
// can request a language hint when the cheap heuristic returns null (no UA
// markers present but Cyrillic). Production pipeline (Wave 3) uses this only on
// the FIRST message >= 20 chars per D-12.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { cyrillicHeuristic, type Lang } from '../../lib/lang-detect.js';
import type { ToolContext } from './index.js';

export const DetectLanguageInputSchema = z.object({ text: z.string().min(1) });

export const DetectLanguageOutputSchema = z.object({
  lang: z.enum(['ru', 'ua']),
  confidence: z.number().min(0).max(1),
});

export type DetectLanguageOutput = z.infer<typeof DetectLanguageOutputSchema>;

export function detectLanguageTool(ctx: ToolContext) {
  return betaZodTool({
    name: 'detectLanguage',
    description:
      'Detect language of a text snippet (ru or ua). Use only when the Cyrillic-script heuristic is ambiguous (no UA markers but Cyrillic present).',
    inputSchema: DetectLanguageInputSchema,
    run: async ({ text }) => {
      // Cheap heuristic first — if it can decide, no LLM round-trip cost is needed.
      const cheap = cyrillicHeuristic(text);
      if (cheap) {
        ctx.log.info(
          { tool: 'detectLanguage', leadId: ctx.leadId, source: 'cyrillic_heuristic' },
          'tool.invoked'
        );
        return JSON.stringify({
          ok: true,
          data: { lang: cheap.lang, confidence: cheap.confidence },
        });
      }
      // No UA marker and no other detector wired yet — fall back to RU at low confidence.
      // The pipeline can choose to escalate to manual triage if confidence is low.
      ctx.log.info(
        { tool: 'detectLanguage', leadId: ctx.leadId, source: 'default' },
        'tool.invoked'
      );
      return JSON.stringify({
        ok: true,
        data: { lang: 'ru' as Lang, confidence: 0.5 },
      });
    },
  });
}
