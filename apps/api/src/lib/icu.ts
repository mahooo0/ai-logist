// Phase 5 (Plan 05-02 — Wave 2) — server-side ICU MessageFormat wrapper.
//
// Thin wrapper over `intl-messageformat@11.2.8` (the actual npm package —
// `@formatjs/intl-messageformat` does NOT exist on the registry, see
// 05-RESEARCH.md "Single Correction" §). Two responsibilities:
//
//   1. CLDR locale mapping. The app uses `'ua'` (country-style code) but
//      `intl-messageformat`'s plural rules require the ISO 639-1 / CLDR
//      locale `'uk-UA'`. Mapping happens at the boundary here (Pitfall §1
//      in 05-RESEARCH.md) so callers never know the difference.
//   2. Compiled-template cache. `new IntlMessageFormat(...)` parses the AST
//      every time; we memoise per (cldrLocale, message) tuple. The cache is
//      bounded by the dictionary size (Phase 5 has ~10 templates), so we
//      use a plain `Map` without an eviction policy (Pitfall §6).

import IntlMessageFormat from 'intl-messageformat';

type AppLang = 'ru' | 'ua';

/**
 * Map the app-level lang code to the CLDR locale that
 * `intl-messageformat` accepts for plural-rule resolution.
 */
function cldrLocaleFor(lang: AppLang): string {
  return lang === 'ua' ? 'uk-UA' : 'ru-RU';
}

// Singleton compiled-template cache. Keyed by `${cldrLocale}::${message}`
// because the same template renders differently under different locales.
const cache = new Map<string, IntlMessageFormat>();

/**
 * Format an ICU MessageFormat template against the given values.
 *
 * @param message  ICU MessageFormat template string. Example:
 *                 `{n, plural, one {# машина} few {# машины} many {# машин}}`.
 * @param values   Substitution map. Numeric values feed plural rules.
 * @param lang     App-level lang code (`'ru'` | `'ua'`).
 * @returns        Rendered string.
 *
 * @throws         If the template is malformed. Callers should pre-validate
 *                 their templates at module-load time (the i18n dictionary
 *                 is static, so malformed templates surface in unit tests
 *                 before they ever reach a real client).
 */
export function formatIcu(
  message: string,
  values: Record<string, string | number>,
  lang: AppLang
): string {
  const cldrLocale = cldrLocaleFor(lang);
  const key = `${cldrLocale}::${message}`;
  let imf = cache.get(key);
  if (!imf) {
    imf = new IntlMessageFormat(message, cldrLocale);
    cache.set(key, imf);
  }
  const result = imf.format(values);
  return Array.isArray(result) ? result.join('') : String(result);
}
