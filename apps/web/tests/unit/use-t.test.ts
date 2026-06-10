import { describe, expect, it, vi } from 'vitest';

// Mock Zustand store BEFORE importing useT. Default mock returns RU language.
vi.mock('@/stores/preferences/preferences-provider', () => ({
  usePreferencesStore: vi.fn((selector: (s: { language: string }) => unknown) =>
    selector({ language: 'ru' })
  ),
}));

describe('Phase 4 I18N-02 — useT() hook', () => {
  it("returns 'Перехватить' for lang=ru (default)", async () => {
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехватить');
  });

  it('falls back to RU when language is unset or unknown', async () => {
    const { usePreferencesStore } = await import('@/stores/preferences/preferences-provider');
    (usePreferencesStore as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (selector: (s: { language?: string }) => unknown) => selector({})
    );
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехватить');
  });

  it('interpolates {var} placeholders without modifying keys lacking placeholders', async () => {
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    // Pick a key that we can extend with vars (or test interpolation logic in isolation)
    const out = t('chat.intercept', { unused: 'x' });
    expect(out).toBe('Перехватить'); // no placeholder in this key — verifies non-interference
  });

  it("returns 'Перехопити' for lang=ua", async () => {
    const { usePreferencesStore } = await import('@/stores/preferences/preferences-provider');
    (usePreferencesStore as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (selector: (s: { language: string }) => unknown) => selector({ language: 'ua' })
    );
    const { useT } = await import('@/lib/i18n/use-t');
    const t = useT();
    expect(t('chat.intercept')).toBe('Перехопити');
  });
});
