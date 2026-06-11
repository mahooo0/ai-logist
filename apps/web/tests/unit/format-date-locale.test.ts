import { describe, test } from 'vitest';

// I18N-04 scaffold — Wave 3 (Plan 05-03) flips the pending marker to
// it() blocks asserting formatDateLocale renders RU + UA dates correctly
// via date-fns/locale subpath imports:
//   formatDateLocale(new Date('2026-06-08'), 'ru') === '8 июн, пн'
//   formatDateLocale(new Date('2026-06-08'), 'ua') === '8 чер, пн'
// Bundle invariant: only date-fns/locale/{ru,uk} subpaths import — no
// barrel import that drags every locale into the client bundle (per
// D-18 — date-fns@4 + tree-shake).
describe('I18N-04: formatDateLocale renders RU/UA dates via date-fns/locale', () => {
  test.todo('RU "8 июн, ср" + UA "8 чер, ср" rendering via date-fns/locale/{ru,uk}');
});
