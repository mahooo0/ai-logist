// Phase 5 (Plan 05-02 — Wave 2) — client-side ICU MessageFormat wrapper.
//
// Mirror of `apps/api/src/lib/icu.ts` for the admin web. Wraps
// `intl-messageformat@11.2.8` (the real npm package — see 05-RESEARCH.md
// "Single Correction" §) with a CLDR locale boundary mapping plus a
// per-template compile cache.
//
// Why the mapping. The app stores lang as `'ru' | 'ua'` (country-style code
// for the Ukrainian side), but `intl-messageformat`'s plural rules require
// the ISO 639-1 / CLDR locale `'uk-UA'` for Ukrainian. We map at the boundary
// here (Pitfall §1 in 05-RESEARCH.md) so callers never see the difference.
//
// Cache lives at module scope. Phase 5 ships 5 admin plural templates × 2
// langs = 10 keyed entries; no eviction policy needed (Pitfall §6).

import IntlMessageFormat from 'intl-messageformat';

type AppLang = 'ru' | 'ua';

function cldrLocaleFor(lang: AppLang): string {
  return lang === 'ua' ? 'uk-UA' : 'ru-RU';
}

const cache = new Map<string, IntlMessageFormat>();

/**
 * Format an ICU MessageFormat plural template against the given numeric value.
 *
 * @param template  ICU MessageFormat plural template string. Example:
 *                  `{n, plural, one {# машина} few {# машины} many {# машин} other {# машин}}`.
 *                  The `other` clause is mandatory per the ICU spec — the parser
 *                  throws `MISSING_OTHER_CLAUSE` otherwise.
 * @param n         Numeric value driving the plural rule.
 * @param lang      App-level lang code (`'ru'` | `'ua'`).
 * @returns         Rendered string (the `#` placeholder is substituted with `n`).
 */
export function formatPlural(template: string, n: number, lang: AppLang): string {
  const cldrLocale = cldrLocaleFor(lang);
  const key = `${cldrLocale}::${template}`;
  let imf = cache.get(key);
  if (!imf) {
    imf = new IntlMessageFormat(template, cldrLocale);
    cache.set(key, imf);
  }
  const result = imf.format({ n });
  return Array.isArray(result) ? result.join('') : String(result);
}
