import { describe, test } from 'vitest';

// I18N-05 scaffold — Wave 2 (Plan 05-02) flips the pending marker to it()
// blocks asserting the declension-free template invariant: every route /
// city reference in apps/api/src/lib/i18n.ts uses the arrow-separator
// pattern "Маршрут: {from} → {to}" and NEVER the genitive forms
// "из {from} в {to}" / "у {to}". Cities are stored as nominative only;
// runtime declension is out of scope for v1.
describe('I18N-05: declension-free templates (no genitive city forms)', () => {
  test.todo('grep for "из {from}" / "в {to}" / "у {to}" patterns in i18n.ts returns no matches');
});
