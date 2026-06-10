'use client';
// apps/web/src/lib/i18n/use-t.ts
// Reads Zenith's preferences-store hook (VENDOR.md — usePreferencesStore from '@/stores/preferences/preferences-provider').
// Per Wave 1 SUMMARY: Zenith ships Language as 'en' | 'de' | 'fr'.
// Wave 2 extends VENDOR.md guidance: useT() reads the field, treats 'ua' as Ukrainian, every other value (including en/de/fr) falls back to 'ru'.
// (Plan 04-CONTEXT D-51: reuse store; D-55: only translate strings we add.)
import { usePreferencesStore } from '@/stores/preferences/preferences-provider';
import { dict, type DictKey } from './dict';

export function useT() {
  // Zenith's Zustand store exposes a `language` field per VENDOR.md.
  const lang = usePreferencesStore((s) => (s as { language?: string }).language ?? 'ru');
  const safeLang: 'ru' | 'ua' = lang === 'ua' ? 'ua' : 'ru';

  return (key: DictKey, vars?: Record<string, string | number>): string => {
    let out: string = dict[safeLang][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  };
}
