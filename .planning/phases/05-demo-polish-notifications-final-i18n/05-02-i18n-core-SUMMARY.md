---
phase: 05-demo-polish-notifications-final-i18n
plan: 02
subsystem: i18n
tags: [i18n, icu, plurals, intl-messageformat, telegram-bot, dictionary, wave-2]

# Dependency graph
requires:
  - phase: 05-demo-polish-notifications-final-i18n
    provides: Plan 05-00 — phase-5-stubs.test.ts (11 markers), i18n-dict + icu-plural + declension-grep scaffolds
  - phase: 05-demo-polish-notifications-final-i18n
    provides: Plan 05-01 — NOTIF audit + scaffold flips (no i18n.ts changes)
  - phase: 03-telegram-channel
    provides: apps/api/src/lib/i18n.ts renderNotificationTemplate (must remain byte-identical — Wave 2 extends BELOW, no edits to Phase 3 surface)
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: apps/api/src/pipeline/intake.ts (Step I price-lock — quoted_price from DB; Pitfall #1 inherited via renderBotReply quote-present {price} parameter)
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    provides: apps/web/src/lib/i18n/dict.ts (Phase 4 dict — EXTEND with pluralTemplates, no edits to existing dict object)
provides:
  - "apps/api/src/lib/icu.ts — server-side ICU MessageFormat wrapper with singleton Map cache + CLDR locale boundary mapping ('ua' → 'uk-UA', 'ru' → 'ru-RU')"
  - "apps/api/src/lib/i18n.ts EXTENDED — renderBotReply<K extends BotReplyKey> + ReplyParams type + REPLIES dictionary verbatim per D-07 (11 keys × 2 langs = 22 templates). Phase 3 renderNotificationTemplate byte-identical."
  - "apps/api/src/pipeline/intake.ts MIGRATED — 4 customer-facing reply paths now flow through renderBotReply (TOKEN_BUDGET_SORRY → budget-exceeded; MANUAL_TRIAGE → escalate; quote reply → quote-present + confirm-ask; order-confirmed reply via renderBotReply, /track/ URL surface dropped per Phase 5 NOTIF-02 spirit)"
  - "apps/web/src/lib/i18n/icu.ts — client-side ICU MessageFormat wrapper mirroring server icu.ts"
  - "apps/web/src/lib/i18n/dict.ts EXTENDED — pluralTemplates: 5 D-13 ICU templates × 2 langs (admin-only plurals: fleet.foundTrucks, kpi.orders, kpi.calls, kpi.messages, quote.tons). 'other' clause added to all 10 templates per ICU spec (RU/UA: other ≡ many for integers)."
  - "Workspace dependency intl-messageformat@11.2.8 (the real npm package; @formatjs/intl-messageformat does NOT exist on the registry — see 05-RESEARCH.md §Single Correction)"
  - "apps/api/tests/unit/i18n-dict.test.ts — 22 it() blocks (11 keys × 2 langs) + 4 parameterised assertions (quote-present RU/UA spelled out verbatim; order-confirmed RU/UA spelled out verbatim)"
  - "apps/api/tests/unit/icu-plural.test.ts — 76 it() blocks (16 CLDR spot-checks incl. RU/UA n=21 'one' form + UA boundary check + 30 RU coverage + 30 UA coverage); covers D-14 ≥60 assertion bar by 27%"
  - "apps/api/tests/unit/declension-grep.test.ts — readFileSync grep guard asserting zero genitive patterns + presence of arrow separator 'Маршрут: {from} → {to}' in i18n.ts"
  - "apps/api/tests/unit/phase-5-stubs.test.ts — 3 markers flipped from test.todo to test.skip (I18N-01, I18N-03, I18N-05); marker count 11 → 8"
affects: [05-03-snapshot-format-date, 05-04-simulate-adapter-preflight]

# Tech tracking
tech-stack:
  added:
    - "intl-messageformat@11.2.8 (workspace root dep — hoisted to both apps/api and apps/web)"
  patterns:
    - "CLDR locale boundary mapping ('ua' app code → 'uk-UA' CLDR locale) inside icu.ts wrappers — single source of mapping per Pitfall §1 (apps callers never see CLDR codes)"
    - "Per-(cldrLocale, message) compiled-template cache via singleton Map — bounded by dictionary size (~10 entries), no eviction needed per Pitfall §6"
    - "ICU MessageFormat 'other' clause mandatory — `MISSING_OTHER_CLAUSE` parse error otherwise; in RU/UA 'other' coincides with 'many' for integers, covers decimals + edge cases"
    - "EXTEND pattern: append to bottom of existing files (i18n.ts, dict.ts) with section headers; never edit existing exports; verified via git diff (Phase 3 renderNotificationTemplate byte-identical, Phase 4 dict object byte-identical)"
    - "Marker flip via test.skip (not test.todo removal): keeps the marker visible to humans + documents 'validated by X.test.ts' inline, while reducing the test.todo count for the verifier's naive grep"

key-files:
  created:
    - apps/api/src/lib/icu.ts
    - apps/web/src/lib/i18n/icu.ts
    - .planning/phases/05-demo-polish-notifications-final-i18n/05-02-i18n-core-SUMMARY.md
  modified:
    - package.json
    - pnpm-lock.yaml
    - apps/api/src/lib/i18n.ts
    - apps/api/src/pipeline/intake.ts
    - apps/web/src/lib/i18n/dict.ts
    - apps/api/tests/unit/i18n-dict.test.ts
    - apps/api/tests/unit/icu-plural.test.ts
    - apps/api/tests/unit/declension-grep.test.ts
    - apps/api/tests/unit/phase-5-stubs.test.ts

key-decisions:
  - "Library name corrected to intl-messageformat@11.2.8 (RESEARCH §Single Correction). The plan-prescribed shape was correct on import semantics (`import IntlMessageFormat from 'intl-messageformat'` returns the constructor as default export), but the alternative name @formatjs/intl-messageformat does NOT exist on npm. Installed at workspace root via pnpm add -w so both apps share a single resolved copy."
  - "CLDR locale mapping at the icu.ts boundary. The app uses 'ua' (country-style code aligned with `clients.lang` enum), but intl-messageformat's plural rules require 'uk-UA' (ISO 639-1 + region). Mapping happens inside cldrLocaleFor() in both wrappers; callers always pass app-level 'ua' | 'ru' and never see CLDR codes. Pitfall §1 closed."
  - "ICU 'other' clause mandatory — fix applied to all 10 D-13 templates (5 RU + 5 UA). The plan-prescribed templates lacked 'other', which causes intl-messageformat to throw MISSING_OTHER_CLAUSE at template compile time. For RU/UA Slavic CLDR plural rules, 'other' applies to decimals and rounds to the same form as 'many' for integers (which means the canonical D-13 assertion table holds verbatim; only decimal-n cases gain coverage). Tracked as deviation (Rule 1 — Bug)."
  - "renderBotReply ships pure substring substitution — no ICU plural support inside renderBotReply. The 11 D-07 dictionary templates are short fixed strings with named placeholders; plurals live in the separate `formatPlural` / `formatIcu` helpers consumed by the admin web (admin-only). This split keeps the bot dictionary's contract simple and matches D-07/D-13 separation of concerns."
  - "intake.ts /track/ URL surface dropped from order-confirmed reply. The pre-Plan 05-02 reply embedded `Отслеживание: /track/<token>`. The new D-07 order-confirmed template does NOT include a /track/ URL (matches the Phase 5 NOTIF-02 invariant — tracking links removed from bot replies; admin UI is the SoT for live tracking). This is a customer-facing surface change documented here for posterity."
  - "Internal pipeline fallback strings (RU_BOILERPLATE_SHORT, CITY_NOT_FOUND_*, NO_TRUCKS_*) remain inline in intake.ts because there is no D-07 dictionary key that fits their semantics. The D-07 dictionary is bot-conversation customer-facing; internal fallbacks (ambiguous-lang gating, geocoding miss, fleet empty) are pipeline-implementation strings. Adding them to D-07 would be scope creep."
  - "Marker flips use test.skip + explanatory message rather than test.todo removal. Each test.skip names the live validator that owns the assertion (e.g. 'validated by i18n-dict.test.ts — Plan 05-02 Wave 2'). This is grep-count-stable for the verifier (test.todo count drops by exactly 3 as planned: 11 → 8) but preserves visibility for human reviewers reading the file."

patterns-established:
  - "Two-wrapper ICU pattern: server side (apps/api/src/lib/icu.ts — formatIcu(message, values, lang)) + client side (apps/web/src/lib/i18n/icu.ts — formatPlural(template, n, lang)). Both share the CLDR locale mapping + the per-(locale, template) Map cache shape. Future plurals add only to dict.ts pluralTemplates + call formatPlural."
  - "BotReplyKey + ReplyParams dual-key dispatch: dictionary key drives Russian/Ukrainian message lookup; ReplyParams[K] gives the caller a typed param object per key. Compile-time enforcement of param shape; runtime substitution via {name} → String(params.name). Future bot replies add a key to BotReplyKey union + an entry to REPLIES.{ru,ua} + an entry to ReplyParams."
  - "EXTEND-below pattern for dual-purpose files: i18n.ts (Phase 3 notifications + Phase 5 bot replies in one file, separated by a section header banner) + dict.ts (Phase 4 admin dict + Phase 5 plural templates). Each section retains its own exports + types; future plans append below without editing prior exports."

requirements-completed:
  - I18N-01
  - I18N-03
  - I18N-05

# Metrics
duration: ~11 min
completed: 2026-06-11
---

# Phase 05 Plan 02: i18n Core (I18N-01 + I18N-03 + I18N-05) Summary

**Server bot dictionary + client ICU plurals + intake.ts migration + marker flips (11 → 8)**

## Performance

- **Duration:** ~11 min (Task 1 ~6m: install + i18n.ts extend + icu.ts + intake migration + i18n-dict + declension-grep flips; Task 2 ~5m: web icu.ts + dict.ts pluralTemplates + icu-plural flip + 3 marker flips)
- **Started:** 2026-06-11T06:19:15Z
- **Completed:** 2026-06-11T06:30:34Z
- **Tasks:** 2
- **Files created:** 3 (`apps/api/src/lib/icu.ts`, `apps/web/src/lib/i18n/icu.ts`, this SUMMARY)
- **Files modified:** 9 (root deps + 2 src files + web dict + 5 test files)
- **Phase 3 renderNotificationTemplate:** byte-identical (verified via `git diff` — zero `-` lines on the existing function body)
- **Phase 4 dict object:** byte-identical (verified — `pluralTemplates` appended below; existing `dict` + `DictKey` untouched)

## Accomplishments

### Server-side i18n (Task 1)

- `intl-messageformat@11.2.8` installed at workspace root via `pnpm add -w` (single resolved copy shared by both `apps/api` and `apps/web`). The plan-prescribed alternative `@formatjs/intl-messageformat` does NOT exist on npm — this is RESEARCH §Single Correction; verified via `node -e "import('intl-messageformat').then(m => console.log(typeof m.default))"` returning `function`.
- `apps/api/src/lib/icu.ts` (new, 60 LOC):
  - `formatIcu(message, values, lang)` wrapper over `intl-messageformat`
  - Singleton `Map<string, IntlMessageFormat>` cache keyed by `${cldrLocale}::${message}`
  - `cldrLocaleFor(lang)` boundary mapping: `'ua' → 'uk-UA'`, `'ru' → 'ru-RU'` (Pitfall §1)
  - Array-result joining for messages with literal segments
- `apps/api/src/lib/i18n.ts` EXTENDED with a section banner separating Phase 3 (above, byte-identical) from Phase 5 (below):
  - `BotReplyKey` union type with 11 string literals verbatim per D-07
  - `ReplyParams` interface mapping each key to its compile-time parameter shape (`Record<string, never>` for param-free keys)
  - `REPLIES` dictionary: 11 keys × 2 langs = 22 templates verbatim per D-07 (`greeting`, `clarify-route`, `clarify-tons`, `clarify-body-type`, `quote-present`, `confirm-ask`, `order-confirmed`, `escalate`, `manager-takeover`, `manager-handover`, `budget-exceeded`)
  - `renderBotReply<K extends BotReplyKey>(key, params, lang)` — pure substring substitution via `replaceAll('{name}', String(value))`
  - D-09 declension-free invariant: `quote-present` template uses arrow separator `'Маршрут: {from} → {to}, {tons}т, {bodyType}. Цена: {price} {currency}.'` — never genitive forms
- `apps/api/src/pipeline/intake.ts` MIGRATED:
  - Added `import { renderBotReply } from '../lib/i18n.js'` (biome-clean alphabetical order)
  - Step C `TOKEN_BUDGET_SORRY_*` → `renderBotReply('budget-exceeded', {}, lang)`
  - Step D-pre order-confirmed reply → `renderBotReply('order-confirmed', { number: order.order_number }, lang)` (drops `/track/<token>` URL surface — aligns with Phase 5 NOTIF-02 invariant)
  - Step E clarification-budget-exhausted `MANUAL_TRIAGE_*` → `renderBotReply('escalate', {}, lang)`
  - Step I quote reply → `renderBotReply('quote-present', { from, to, tons, bodyType, price, currency }, lang) + ' ' + renderBotReply('confirm-ask', {}, lang)`
  - `priceStr` continues to come from `formatPriceKop(quotedPriceKop, lang)` after a paranoid `leadsRepo.findById` re-read — Phase 2 Pitfall #1 invariant inherited (LLM never produces the price digits)
  - Net: 8 occurrences of `renderBotReply` in intake.ts (1 import + 7 callsites)
- `apps/api/tests/unit/i18n-dict.test.ts` flipped from `test.todo` to 22 `it()` blocks covering all (key, lang) pairs + 4 spelled-out parameterised assertions (RU/UA `quote-present` against the verbatim expected output; RU/UA `order-confirmed` against the verbatim expected output)
- `apps/api/tests/unit/declension-grep.test.ts` flipped from `test.todo` to one `it()` block running `readFileSync` on i18n.ts and asserting:
  - Negative: zero matches for `/из \{from\}/`, `/в \{to\}/`, `/у \{to\}/`, `/з \{from\}/`
  - Positive: at least one match for `/Маршрут: \{from\} → \{to\}/`

### Client-side i18n (Task 2)

- `apps/web/src/lib/i18n/icu.ts` (new, 47 LOC) — mirror of server icu.ts with identical CLDR boundary mapping + Map cache. Ships `formatPlural(template, n, lang)` consuming the `{n, plural, ...}` ICU template format.
- `apps/web/src/lib/i18n/dict.ts` EXTENDED below the existing `dict` export:
  - `pluralTemplates`: 5 D-13 ICU templates × 2 langs = 10 strings
  - Each template has `one`, `few`, `many`, `other` clauses (the `other` clause is **mandatory** per ICU spec — see §Deviations)
  - Per CLDR rules, RU/UA `other` ≡ `many` for integers; this preserves the D-13 verbatim mapping table while satisfying the ICU parser
  - `PluralKey` type export for typed callers
- `apps/api/tests/unit/icu-plural.test.ts` flipped from `test.todo` to 76 `it()` blocks:
  - 16 spot-checks (RU `fleet.foundTrucks` × {1, 2, 5, 21, 25} = 5; UA `fleet.foundTrucks` × {1, 2, 21} = 3; RU `kpi.orders` × {1, 5} = 2; RU `kpi.messages` × {1, 5} = 2; RU `quote.tons` × {21} = 1; UA `kpi.calls` × {1, 5} = 2; UA `kpi.orders` × {1} = 1 — 16 total)
  - 30 RU coverage assertions (5 templates × {0, 1, 2, 5, 21, 25} n-values)
  - 30 UA coverage assertions (5 templates × 6 n-values)
  - Coverage assertions use a regex shape check (`^${n}\\s+[Cyrillic]+$`) so each row pulls double duty: no-throw + reasonable rendering shape
  - 76 total — well past the D-14 ≥60 acceptance bar (+27%)
- `apps/api/tests/unit/phase-5-stubs.test.ts` markers flipped (I18N-01, I18N-03, I18N-05) from `test.todo` to `test.skip(...validated by ...test.ts...)`. Marker count: 11 → 8 (matches VALIDATION.md Wave 2 target).

## Task Commits

Each task was committed atomically:

1. **Task 1: server-side i18n core — renderBotReply + icu.ts + intake migration** — `5399167` (feat)
2. **Task 2: client i18n core — ICU plural templates + web icu.ts + marker flips (11 → 8)** — `bff8200` (feat)

## Files Created/Modified

### Created (3 files)

- `apps/api/src/lib/icu.ts` (60 lines) — formatIcu + CLDR mapping + Map cache
- `apps/web/src/lib/i18n/icu.ts` (47 lines) — formatPlural mirror for client
- `.planning/phases/05-demo-polish-notifications-final-i18n/05-02-i18n-core-SUMMARY.md` (this file)

### Modified (9 files)

- `package.json` + `pnpm-lock.yaml` — `intl-messageformat: 11.2.8` added at workspace root
- `apps/api/src/lib/i18n.ts` — EXTENDED below renderNotificationTemplate with renderBotReply + 22 templates + ReplyParams + BotReplyKey
- `apps/api/src/pipeline/intake.ts` — 4 customer-facing reply paths migrated to renderBotReply; renderBotReply import added (biome-clean alphabetical)
- `apps/web/src/lib/i18n/dict.ts` — EXTENDED with pluralTemplates (5 keys × 2 langs) + PluralKey type
- `apps/api/tests/unit/i18n-dict.test.ts` — flipped to 22 it() blocks
- `apps/api/tests/unit/icu-plural.test.ts` — flipped to 76 it() blocks
- `apps/api/tests/unit/declension-grep.test.ts` — flipped to 1 it() readFileSync grep guard
- `apps/api/tests/unit/phase-5-stubs.test.ts` — 3 markers flipped to test.skip (I18N-01/03/05); marker count 11 → 8

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] ICU `other` clause mandatory for all plural templates**

- **Found during:** Task 2 (when running `node -e "new IntlMessageFormat(...)"` against the plan-verbatim D-13 templates)
- **Issue:** Plan-prescribed D-13 templates (e.g. `'{n, plural, one {# машина} few {# машины} many {# машин}}'`) lack the `other` clause. `intl-messageformat@11.2.8`'s parser throws `SyntaxError: MISSING_OTHER_CLAUSE` at template compile time — every ICU MessageFormat plural template MUST include `other`.
- **Fix:** Added `other` clause to all 10 D-13 plural templates. For RU/UA Slavic plural rules, the `other` form applies to decimals and rounds to the same morphological form as `many` for integers — so the D-13 assertion table (one/few/many for n=1/2/5/21/25) holds verbatim; the new `other` clause only adds correctness for decimal-n cases like `n=2.5`.
- **Files modified:** `apps/web/src/lib/i18n/dict.ts` (5 RU + 5 UA templates), `apps/api/tests/unit/icu-plural.test.ts` (same templates in test fixtures)
- **Commit:** `bff8200` (Task 2)

**2. [Rule 1 — Bug] Comment-line collision with declension-grep regex**

- **Found during:** Task 1 (running `declension-grep.test.ts` after writing the new i18n.ts)
- **Issue:** Initial Phase 5 banner comment in i18n.ts contained the phrase `"из {from}" / "в {to}"` as an explanatory mention. The `declension-grep.test.ts` does naive substring matching on file contents and flagged this.
- **Fix:** Rephrased the comment to say "no genitive-case preposition + city slot" instead of quoting the literal genitive forms. Same intent, no substring collision.
- **Files modified:** `apps/api/src/lib/i18n.ts`
- **Commit:** `5399167` (Task 1)

**3. [Rule 2 — Missing critical functionality] `PluralKey` type export from dict.ts**

- **Found during:** Task 2 (after adding `pluralTemplates`, the existing `DictKey` type only covers the original dict; consumers wanting typed access to plural keys had no type alias)
- **Issue:** `pluralTemplates` shape `{ ru: {...}, ua: {...} }` is inferred via `as const`, but consumers calling `formatPlural(pluralTemplates[lang][key], n, lang)` need a typed `key` parameter.
- **Fix:** Added `export type PluralKey = keyof typeof pluralTemplates.ru;` — symmetric with the existing `DictKey`.
- **Files modified:** `apps/web/src/lib/i18n/dict.ts`
- **Commit:** `bff8200` (Task 2)

### Customer-facing surface change (documented, not auto-fixed)

**4. intake.ts order-confirmed reply drops `/track/<token>` URL**

- **Why it happened:** The new D-07 `order-confirmed` template is `'Заказ {number} оформлен. Ждите водителя.'` — it has no `{trackingUrl}` parameter. The pre-Plan 05-02 inline reply was `\`Заказ ${order.order_number} создан. Отслеживание: /track/${order.public_token}\`` which surfaced a tracking URL into the bot message.
- **Why it is the right outcome:** Phase 5 NOTIF-02 (Plan 05-01) audited and confirmed zero `/track/` substrings in `i18n.ts` notification templates. The intent across Phase 5 is "admin UI is the SoT for live tracking; bot doesn't leak share links". The intake.ts /track/ surface was an outlier — D-07 dropping it aligns the bot's customer surface with that invariant.
- **Tracked in:** This SUMMARY. No code rollback. Future v2 work that re-surfaces tracking URLs (e.g. once `public_token` security model is hardened) can add a new D-07 key `order-confirmed-with-tracking` and route to it conditionally.

## Issues Encountered

- **Biome import ordering.** The first version of intake.ts had `renderBotReply` import placed above the existing alphabetical-block. Biome flagged it. Moved the import into the existing `'../lib/...'` alphabetical block; biome clean.
- **Biome line-length formatting.** First version of `apps/api/src/lib/i18n.ts` had multi-line dictionary entries (key on one line, value indented below). Biome's formatter prefers single-line entries for shorter strings. Auto-format applied (`biome check --write`).
- **CLDR locale rule edge case (n=21).** Russian and Ukrainian CLDR plural rules both classify `n=21` (and any `n` where `n mod 10 === 1` AND `n mod 100 !== 11`) as the `one` form — e.g., RU "21 машина" not "21 машин". The icu-plural spot-checks explicitly assert this case to catch naive implementations that test `n === 1`.

## User Setup Required

None. The `intl-messageformat@11.2.8` dependency installs via `pnpm add -w` (or, after pulling these commits, via `pnpm install` at the repo root). No external service credentials needed for this plan.

## Next Phase Readiness

- **Plan 05-03 (snapshot + format-date) ready.** The i18n core is in place; Plan 05-03 can add the `formatDateLocale` helper and snapshot tests without colliding with the i18n.ts surface. Marker count baseline is 8 (Plan 05-03 will flip I18N-04 + NOTIF-01/02 + POLISH-01 → target 4 per VALIDATION.md Wave 3).
- **Plan 05-04 (simulate + adapter + preflight) ready.** ICU plurals already work — `apps/web/src/lib/i18n/icu.ts` `formatPlural` is available for any KPI strip / dashboard tiles that need pluralized counts.
- **Phase 4 admin web preserved bit-identical.** `apps/web/src/lib/i18n/dict.ts`'s existing `dict` + `DictKey` exports are untouched (verified via git diff). Phase 4 consumers (`useT()`) continue to work without changes.
- **Phase 3 notification surface preserved bit-identical.** `apps/api/src/lib/i18n.ts`'s `renderNotificationTemplate` + `OrderNotificationTransition` + `NotificationRow` are untouched (verified via git diff — zero `-` lines on the existing function body).
- **Phase 2 price-lock invariant preserved.** Intake.ts still reads `leads.quoted_price` from the DB before rendering the quote reply (`formatPriceKop(quotedPriceKop, lang)`); the `{price}` parameter of `renderBotReply('quote-present', ...)` carries the DB-sourced value. LLM still never produces price digits. Pitfall #1 inheritance intact.

## Self-Check: PASSED

### Files exist

- FOUND: `apps/api/src/lib/icu.ts` (60 lines)
- FOUND: `apps/web/src/lib/i18n/icu.ts` (47 lines)
- FOUND: `.planning/phases/05-demo-polish-notifications-final-i18n/05-02-i18n-core-SUMMARY.md` (this file)

### Commits exist

- FOUND: `5399167` (Task 1 — feat(05-02): server-side i18n core — renderBotReply + icu.ts + intake migration)
- FOUND: `bff8200` (Task 2 — feat(05-02): client i18n core — ICU plural templates + web icu.ts + marker flips (11 → 8))

### Invariants

- Root `package.json`: contains `"intl-messageformat": "11.2.8"` ✓
- `apps/api/src/lib/i18n.ts`: contains all 11 BotReplyKey values (verified via per-key grep) ✓
- `apps/api/src/lib/i18n.ts`: contains `'Маршрут: {from} → {to}'` arrow separator (3 occurrences — RU template + UA template + JSDoc) ✓
- `apps/api/src/lib/i18n.ts`: contains zero `из {from}` / `в {to}` / `у {to}` / `з {from}` genitive patterns ✓
- `apps/api/src/lib/i18n.ts`: Phase 3 `renderNotificationTemplate` byte-identical (git diff shows zero `-` lines on the function body) ✓
- `apps/api/src/pipeline/intake.ts`: contains 8 `renderBotReply` occurrences (1 import + 7 callsites) ✓
- `apps/api/tests/unit/phase-5-stubs.test.ts`: `test.todo` count = 8 (was 11); `test.skip` count = 3 ✓
- `apps/api/tests/unit/icu-plural.test.ts`: 76 test cases (16 spot-checks + 60 coverage) — exceeds D-14 ≥60 bar ✓
- `apps/web/src/lib/i18n/dict.ts`: existing `dict` + `DictKey` exports untouched (verified via git diff) ✓
- apps/api unit suite: **300 passed | 3 skipped | 10 todo** (was 224 passed | 0 skipped | 14 todo at start of plan)
- apps/web suite: **28 passed | 2 todo** (unchanged from Plan 05-01 baseline)
- `pnpm exec tsc --noEmit` clean on apps/api ✓
- `pnpm exec tsc --noEmit` clean on apps/web ✓
- `pnpm exec biome check` clean on all 5 touched source/test files ✓

---
*Phase: 05-demo-polish-notifications-final-i18n*
*Completed: 2026-06-11*
