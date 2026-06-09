// Phase 2 Plan 02-01 Task 2 — sticky RU/UA language detection.
// LOGIC-02. CONTEXT D-12..D-15.

import { describe, expect, it, vi } from 'vitest';
import { cyrillicHeuristic, detectLang, UA_MARKERS } from '../../src/lib/lang-detect.js';

describe('UA_MARKERS regex', () => {
  it('matches Ukrainian-specific glyphs', () => {
    expect(UA_MARKERS.test('Київ')).toBe(true); // і
    expect(UA_MARKERS.test('Львів')).toBe(true); // і
    expect(UA_MARKERS.test('Україна')).toBe(true); // ї
    expect(UA_MARKERS.test('ґанок')).toBe(true); // ґ
    expect(UA_MARKERS.test('є')).toBe(true);
    expect(UA_MARKERS.test('Є')).toBe(true);
  });

  it('does not match RU-only Cyrillic', () => {
    expect(UA_MARKERS.test('Москва')).toBe(false);
    expect(UA_MARKERS.test('Привет')).toBe(false);
    expect(UA_MARKERS.test('Киев-Львов 18т')).toBe(false);
  });
});

describe('cyrillicHeuristic', () => {
  it('returns ua with confidence 1.0 for "Київ-Львів 18т"', () => {
    const r = cyrillicHeuristic('Київ-Львів 18т');
    expect(r).not.toBeNull();
    expect(r?.lang).toBe('ua');
    expect(r?.confidence).toBe(1.0);
    expect(r?.source).toBe('cyrillic_heuristic');
  });

  it('returns ua for mixed Surzhyk "Київ → Львов" (any UA marker wins per D-15)', () => {
    const r = cyrillicHeuristic('Київ → Львов');
    expect(r?.lang).toBe('ua');
  });

  it('returns null for pure RU "Киев-Львов 18т"', () => {
    expect(cyrillicHeuristic('Киев-Львов 18т')).toBeNull();
  });

  it('returns null for very short "ок"', () => {
    expect(cyrillicHeuristic('ок')).toBeNull();
  });
});

describe('detectLang', () => {
  it('short messages (<20 chars) return ru/default without calling LLM', async () => {
    const llmDetect = vi.fn();
    const r = await detectLang('ок', llmDetect);
    expect(r.lang).toBe('ru');
    expect(r.source).toBe('default');
    expect(llmDetect).not.toHaveBeenCalled();
  });

  it('UA-marker text resolves via heuristic without LLM', async () => {
    const llmDetect = vi.fn();
    const r = await detectLang('Поїхали Київ-Львів 18 тонн', llmDetect);
    expect(r.lang).toBe('ua');
    expect(r.confidence).toBe(1.0);
    expect(r.source).toBe('cyrillic_heuristic');
    expect(llmDetect).not.toHaveBeenCalled();
  });

  it('ambiguous Cyrillic falls back to LLM and respects confidence ≥ 0.7', async () => {
    const llmDetect = vi.fn().mockResolvedValue({ lang: 'ru', confidence: 0.9 });
    const r = await detectLang('Привет, нужна машина Москва-Воронеж', llmDetect);
    expect(r.lang).toBe('ru');
    expect(r.source).toBe('llm');
    expect(llmDetect).toHaveBeenCalledOnce();
  });

  it('low-confidence LLM result falls back to ru/default', async () => {
    const llmDetect = vi.fn().mockResolvedValue({ lang: 'ua', confidence: 0.4 });
    const r = await detectLang('Привет, нужна машина Москва-Воронеж', llmDetect);
    expect(r.lang).toBe('ru');
    expect(r.source).toBe('default');
  });
});
