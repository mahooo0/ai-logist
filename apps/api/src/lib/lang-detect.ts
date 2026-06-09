// Phase 2 Plan 02-01 Task 2 — sticky RU/UA language detection.
// LOGIC-02. CONTEXT D-12..D-15.
//
// Two-detector vote:
//   1. Cyrillic-script heuristic: presence of є / і / ї / ґ → UA, confidence 1.0.
//   2. LLM `detectLanguage` callback for ambiguous Cyrillic without UA markers.
// Messages <20 chars get RU default (D-14) — too short to detect reliably.
//
// Source: 02-RESEARCH.md §16 (verbatim).

/**
 * UA-specific Cyrillic glyphs. Presence of ANY of these strongly signals Ukrainian.
 * Mixed Surzhyk RU+UA → still classified as UA per D-15.
 */
export const UA_MARKERS = /[єіїґЄІЇҐ]/;

export type Lang = 'ru' | 'ua';

export interface LangVote {
  lang: Lang;
  confidence: number; // 0..1
  source: 'cyrillic_heuristic' | 'llm' | 'default';
}

/**
 * Step 1 of D-13: zero-cost script heuristic.
 * Returns null if no UA marker present (caller falls back to LLM).
 */
export function cyrillicHeuristic(text: string): LangVote | null {
  if (UA_MARKERS.test(text)) {
    return { lang: 'ua', confidence: 1.0, source: 'cyrillic_heuristic' };
  }
  // Cyrillic without UA markers → undecidable cheaply. Caller calls llmDetect.
  return null;
}

/**
 * Two-detector vote: script heuristic first, LLM fallback for ambiguous cases.
 *
 * D-12: only call this on the FIRST message ≥ 20 chars.
 * D-14: shorter messages return RU default and are answered with boilerplate.
 */
export async function detectLang(
  text: string,
  llmDetect: (text: string) => Promise<{ lang: Lang; confidence: number }>
): Promise<LangVote> {
  if (text.length < 20) {
    return { lang: 'ru', confidence: 0.0, source: 'default' };
  }
  const heuristic = cyrillicHeuristic(text);
  if (heuristic) return heuristic;
  const llm = await llmDetect(text);
  if (llm.confidence >= 0.7) return { lang: llm.lang, confidence: llm.confidence, source: 'llm' };
  return { lang: 'ru', confidence: 0.5, source: 'default' };
}
