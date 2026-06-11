// Phase 5 Plan 05-03 — I18N-04 formatDateLocale assertions.
//
// Wave 0 scaffold flipped to live tests. Validates that
// apps/web/src/lib/format.ts ships formatDateLocale + formatDateTimeLocale
// using date-fns/locale per-path subpath imports (Pitfall §2 — barrel
// imports drag every locale through Turbopack tree-shake regressions).
//
// Fixture date 2026-06-08T12:00:00Z is a Monday in the real calendar but
// assertions intentionally allow any 2–3 char day-of-week abbreviation so
// tests stay robust against IANA timezone shifts at runtime.

import { describe, expect, it } from 'vitest';
import { formatDateLocale, formatDateTimeLocale } from '../../src/lib/format';

describe('I18N-04: formatDateLocale renders RU + UA via date-fns/locale', () => {
  const fixedDate = new Date('2026-06-08T12:00:00Z');

  it('renders RU date with abbreviated month "июн" and day-of-week', () => {
    const out = formatDateLocale(fixedDate, 'ru');
    // Shape: "8 <month-abbr>, <day-abbr>" — Cyrillic letters only.
    // date-fns RU: month "июн" (3 chars), dow "пн/вт/.../вс" (2 chars).
    expect(out).toMatch(/^\d{1,2} [а-яё]{3,5}\.?,? [а-яё]{2,4}\.?$/i);
    expect(out).toContain('июн');
  });

  it('renders UA date with abbreviated month "чер" and day-of-week', () => {
    const out = formatDateLocale(fixedDate, 'ua');
    // date-fns UA: month "черв" (4 chars + optional dot), dow "пон/вів/..." (3 chars).
    expect(out).toMatch(/^\d{1,2} [а-яії]{3,5}\.?,? [а-яії]{2,4}\.?$/i);
    expect(out).toContain('чер');
  });

  it('accepts ISO string and renders RU', () => {
    expect(formatDateLocale('2026-06-08T12:00:00Z', 'ru')).toMatch(/июн/);
  });

  it('defaults to RU when lang omitted', () => {
    expect(formatDateLocale(fixedDate)).toMatch(/июн/);
  });

  it('formatDateTimeLocale renders time component (HH:mm)', () => {
    const out = formatDateTimeLocale(fixedDate, 'ru');
    expect(out).toMatch(/\d{2}:\d{2}/);
    expect(out).toContain('июн');
  });

  it('formatDateTimeLocale UA also includes time + month abbrev', () => {
    const out = formatDateTimeLocale(fixedDate, 'ua');
    expect(out).toMatch(/\d{2}:\d{2}/);
    expect(out).toContain('чер');
  });
});
