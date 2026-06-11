// apps/web/src/lib/format.ts
// Money + phone + date formatters consumed by Waves 4 + 5 page rewires.
// D-32 (orders price), D-28 (calls phone mask + duration mm:ss), D-54 (Intl dates — Phase 5 ships date-fns/locale via I18N-04).
//
// Phase 5 Plan 05-03 I18N-04: per-path date-fns/locale imports for formatDateLocale.
// MUST stay on subpath imports (date-fns/locale/ru, date-fns/locale/uk) — the
// non-suffixed barrel index pulls all 100+ locales via Turbopack tree-shake
// regression (Pitfall §2). Subpath imports = ~12-15 KB gzipped each.
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import parsePhoneNumberFromString from 'libphonenumber-js';

type Lang = 'ru' | 'ua';

// formatMoney — kopecks (bigint) → ruble integer display per RESEARCH §Anti-Patterns note.
// Phase 4 shows whole rubles (no kopecks decimals) — matches demo display style.
export function formatMoney(kopecksLike: string | number | bigint, lang: Lang = 'ru'): string {
  const kopecks = typeof kopecksLike === 'string' ? BigInt(kopecksLike) : BigInt(kopecksLike);
  const rubles = Number(kopecks / BigInt(100)); // integer rubles, safe for demo-scale values
  const locale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(rubles);
}

// formatPhone — libphonenumber-js with optional last-4-masking for /calls + /chat thread list (D-28).
export function formatPhone(e164: string, opts: { mask?: boolean } = {}): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  const intl = parsed.formatInternational();
  if (!opts.mask) return intl;
  // Mask middle, keep last 4
  const last4 = parsed.nationalNumber.slice(-4);
  const prefix = parsed.countryCallingCode;
  return `+${prefix} *** ${last4}`;
}

// formatDate — D-54: Intl.DateTimeFormat now; date-fns/locale = Phase 5 (I18N-04).
export function formatDate(iso: string, lang: Lang = 'ru'): string {
  const locale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// formatDuration — mm:ss for call durations (D-28).
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// === I18N-04: formatDateLocale + formatDateTimeLocale (Phase 5 Plan 05-03) ===
// date-fns/locale per-path imports (declared at top of file). Renders:
//   formatDateLocale(date, 'ru') → "8 июн, ср"
//   formatDateLocale(date, 'ua') → "8 чер, ср"
// Used by admin display only (chat thread list, calls timestamps, order timeline).
// Bot replies continue to use Intl.DateTimeFormat via formatDate above (D-17).
export function formatDateLocale(date: Date | string, lang: Lang = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lang === 'ua' ? uk : ru;
  return format(d, 'd MMM, EEE', { locale });
}

export function formatDateTimeLocale(date: Date | string, lang: Lang = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lang === 'ua' ? uk : ru;
  return format(d, 'd MMM, EEE HH:mm', { locale });
}
