# Phase 5: Demo Polish + Notifications + Final i18n — Research

**Researched:** 2026-06-11
**Domain:** ICU pluralization, locale-aware dates, LLM provider adapter (Anthropic ↔ OpenAI), snapshot testing, demo-day insurance (preflight + simulate-call + fallback video)
**Confidence:** HIGH on library APIs (verified against npm registry + official docs); MEDIUM on OpenAI↔Anthropic adapter shape (cross-verified docs + project canon); HIGH on existing-code reuse paths (read source)

## Summary

Phase 5 is **strictly additive polish on top of fully-shipped Phase 1-4 infrastructure**. The 56 locked CONTEXT decisions cover every consequential choice (libraries, file paths, trigger boundaries, failover mechanism). Research must therefore (a) verify the locked library names and versions against the live npm registry, (b) document exact import paths and API call shapes that planning needs to write task lists, (c) catalog the existing Phase 3 / 3.1 / 4 reuse points so plans don't duplicate code, and (d) flag the **one correction** that surfaced during verification.

**Single correction:** CONTEXT D-12 specifies `@formatjs/intl-messageformat@10.x` — that package name is wrong. The correct npm package is **`intl-messageformat`** (no scope, latest 11.2.8). FormatJS scope packages exist (`@formatjs/icu-messageformat-parser`, `@formatjs/intl`) but the user-facing ICU formatter is published as `intl-messageformat`. Plans must use `pnpm add intl-messageformat` and `import IntlMessageFormat from 'intl-messageformat'`.

**Second correction:** CONTEXT D-44 specifies `openai@4.x`. The current stable on npm is **6.42.0** (June 2026), and the modern path is the Responses API rather than Chat Completions. For a 2-week demo failover, `openai@4.x` is still installable and works for Chat Completions tool-use — but plans should pin a verified `^4.x` release (e.g. `4.104.0`) explicitly because `^4` resolves to v6 if `dist-tags.latest` is followed. RECOMMENDATION: pin `openai@4.104.0` exactly OR upgrade decision to `openai@^6` and use Chat Completions (still supported per OpenAI changelog through 2026).

**Primary recommendation:** Treat Phase 5 as a 5-wave delta on top of working code: (W0) test scaffolds + ICU/date-fns deps, (W1) NOTIF audit + i18n.ts extension, (W2) ICU plural + formatDateLocale, (W3) snapshot tests + simulate-call route, (W4) preflight + provider adapter, (W5) video bundle + HUMAN-UAT-06. No new infrastructure; no schema migrations; no Phase 1-3.1 code mutation outside the well-defined extension points.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification Triggers (NOTIF-01 + NOTIF-02)**
- D-01: REUSE Phase 3 infrastructure. `apps/api/src/lib/i18n.ts` `renderNotificationTemplate` already ships RU + UA templates for DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED. `apps/api/src/channels/telegram/notifications.ts` `notifyClient` already invokes from FSM `onSuccess` post-commit hook. Phase 5 does NOT rewrite — only AUDITS and EXTENDS.
- D-02: Verify all 3 transitions fire end-to-end. If any of DRIVER_ASSIGNED / IN_TRANSIT / DELIVERED is not wired in ORDER_TRANSITIONS with notifyClient onSuccess, Phase 5 adds it.
- D-03: NO `/track/[token]` link in any notification template. CI grep guard: `grep -E "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts && exit 1 || exit 0`.
- D-04: Notifications are Telegram-only. Skip silently when `clients.telegram_id` is NULL.
- D-05: Idempotency via `order_events` UNIQUE(order_id, type) — Phase 1's constraint guarantees each transition fires exactly once.

**Server-side i18n Dictionary (I18N-01)**
- D-06: Extend `apps/api/src/lib/i18n.ts` (not create new file). Add `renderBotReply(key, params, lang)` for non-notification bot replies + move dictionary out of `apps/api/src/pipeline/intake.ts` inline strings.
- D-07: 11 dictionary keys × 2 langs = 22 templates (greeting, clarify-route, clarify-tons, clarify-body-type, quote-present, confirm-ask, order-confirmed, escalate, manager-takeover, manager-handover, budget-exceeded). Numerical params (`{price}`, `{tons}`, `{number}`) MUST come from DB row, never LLM paraphrase.
- D-08: Voice channel templates stay in `elevenlabs-agent-config.md`. Phase 5 i18n.ts is TEXT-channel only.

**Declension-free Templates (I18N-05)**
- D-09: Audit all templates for declined city names. Use `"Маршрут: {from} → {to}"` symbol-separated, NOT `"из {from} в {to}"`.
- D-10: Cities stored as nominative only. No declension API.
- D-11: Audit checklist for quote-present, clarify-route, DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED.

**ICU Pluralization (I18N-03)**
- D-12: Library: `@formatjs/intl-messageformat@10.x` (**RESEARCH CORRECTION**: correct npm name is `intl-messageformat`, latest 11.2.8 — see Standard Stack). Add as workspace dep at root, import in BOTH `apps/web/src/lib/i18n/dict.ts` and `apps/api/src/lib/i18n.ts`.
- D-13: 5 plural templates × 2 langs = 10 templates (машина/машини/машин etc.).
- D-14: Snapshot test asserting outputs for `n ∈ {0, 1, 2, 5, 21, 25}` × 5 templates × 2 langs = 60 assertions.
- D-15: Bot replies don't render dynamic counts in v1 — server-side i18n.ts adds ICU helper but doesn't use it yet.

**date-fns/locale (I18N-04)**
- D-16: Add `date-fns/locale` to `apps/web/src/lib/format.ts`. `formatDateLocale(date, lang)` renders "8 июн, ср" (RU) / "8 чер, ср" (UA).
- D-17: Apply to admin display only. Bot replies stay on `Intl.DateTimeFormat`.
- D-18: Pin `date-fns@4` (already locked). Tree-shake — only import `ru` + `uk` locales.

**Snapshot Tests (POLISH-01)**
- D-19: REUSE existing `apps/api/tests/fixtures/canonical-inputs.json` (20 inputs already exist).
- D-20: Vitest snapshots in `apps/api/tests/snapshots/__snapshots__/`. Two files: `extract-request.snap.ts` + `calc-price.snap.ts`.
- D-21: Byte-stability via MockAnthropicClient from Phase 2 + `llm-responses.json` fixtures. NO live LLM calls.
- D-22: CI gate: `pnpm --filter @ai-logist/api test apps/api/tests/snapshots/` exits 0 + snapshots committed.

**"Simulate Inbound Call" Button (POLISH-02)**
- D-23: NEW `POST /api/admin/simulate-call` in `apps/api/src/routes/admin.ts`. Accepts `{ scenarioKey: 'ru_happy_path' | 'ua_happy_path' | 'injection_attempt' | 'ambiguous_clarification' | 'abandon_mid_call' }`.
- D-24: Implementation reads `voice-scenarios.json`, creates fake `calls` row (audio_url=NULL, transcript=scenario.turns), replays each turn through Phase 3.1 voice tool handlers, returns `{ callId, leadId, orderId }`.
- D-25: Frontend button "▶ Simulate inbound call" on `/dashboard/calls` page header. Modal with 5 scenario buttons → POST → SWR refetch → new call appears in table within 5s. Same `CallDetailModal` as real calls.
- D-26: MUST work without Twilio + ElevenLabs (no external API calls).
- D-27: No new auth — behind existing `proxy.ts` auth gate.

**Voice Fallback Video (POLISH-03)**
- D-28: `apps/web/public/demo/voice-fallback.mp4` — ~30-60s real call.
- D-29: ≤15 MB. `.gitattributes` marks as binary.
- D-30: Button "🎬 Видео-резерв" on `/dashboard/calls`. Modal with native `<video controls preload="metadata">` + RU caption track.
- D-31: NO admin record — pure-demo content.
- D-32: `apps/web/public/demo/voice-fallback.ru.vtt` — WebVTT, ~20 cues. UA optional.

**Pre-flight Checklist (POLISH-05)**
- D-33: `apps/api/scripts/preflight.ts`, runnable via `pnpm preflight`.
- D-34: 6 sequential fail-fast checks (Telegram bot alive / Twilio registered / DB seeded / /api/health / LLM key / E2E smoke RU+UA via simulate-call).
- D-35: Output: `✓ {name} ({duration_ms}ms)` or `✗ {name}: {error}`. Total ≤30s.
- D-36: NO Wialon/GPS checks.
- D-37: NO /track link check.
- D-38: NOT in CI gates (needs real credentials). README "Demo Day Checklist" section.

**LLM_PROVIDER Failover (POLISH-06)**
- D-39: `LLM_PROVIDER` ∈ {`anthropic`, `openai`}, default `anthropic`. `OPENAI_API_KEY` optional in config.ts Zod schema.
- D-40: Adapter pattern in `apps/api/src/lib/llm/provider.ts`: `getLLMClient(): LLMClient`.
- D-41: OpenAI adapter wraps `openai.chat.completions.create({ tools, tool_choice, messages })`. Translates OpenAI tool call format → Anthropic-shape via mapper. Outputs validated by same Zod schemas.
- D-42: ENV swap + restart (not runtime hot-swap). `docker compose exec api sh -c "export LLM_PROVIDER=openai && kill -HUP 1"`.
- D-43: NO automatic failover. Demo operator swaps manually. Document 30-second swap procedure.
- D-44: Add `openai@4.x` to `apps/api/package.json` (**RESEARCH CORRECTION**: see Standard Stack — pin `openai@4.104.0` exactly OR negotiate upgrade to `openai@^6` with planner).
- D-45: Tool registry compatibility — both adapters consume same Phase 2 tool registry.
- D-46: Anti-Pitfall #1 maintained — OpenAI adapter ALSO renders prices from `leads.quoted_price` (templated, not paraphrased).

**Testing Strategy**
- D-47: Unit tests: `i18n-dict.test.ts` (22 templates + no /track/), `icu-plural.test.ts` (60 assertions), `llm-provider-adapter.test.ts` (both adapters same output for same input mocked), `format-date-locale.test.ts` (RU "8 июн, ср" + UA "8 чер, ср").
- D-48: Snapshot tests per D-20.
- D-49: Integration tests: `notif-fsm-transitions.test.ts` (each ORDER_TRANSITION fires notifyClient mocked) + `simulate-call.test.ts` (5 scenarios → call+lead+order).
- D-50: NO new E2E. Relies on HUMAN-UAT-06.md.

**Configuration & Env**
- D-51: New env vars: `LLM_PROVIDER` (optional), `OPENAI_API_KEY` (optional).
- D-52: No new infrastructure.

**File Layout**
- D-53: Backend additions: `apps/api/src/lib/llm/{provider,anthropic-adapter,openai-adapter}.ts`, `apps/api/src/routes/admin.ts`, `apps/api/src/lib/icu.ts` (server-side ICU wrapper), `apps/api/scripts/preflight.ts`.
- D-54: Frontend additions: `apps/web/public/demo/{voice-fallback.mp4,voice-fallback.ru.vtt}`, `apps/web/src/app/(main)/dashboard/calls/_components/{simulate-call-modal,voice-fallback-modal}.tsx`, `apps/web/src/lib/i18n/icu.ts`.
- D-55: Test additions per D-47..D-49.
- D-56: Docs: README "Demo Day Checklist", `apps/web/public/demo/README.md`, `HUMAN-UAT-06.md`.

### Claude's Discretion

- Exact wording of new bot replies (D-07 keys) — render plausible RU/UA during planning
- Video recording: who records it (team coordinates physically before demo); Plan 05-XX-voice-video.md should include checklist
- Pre-flight check ordering refinements
- Whether to add `pnpm preflight --json` machine-readable output (recommend yes)
- Specific OpenAI model choice (`gpt-4o` recommended for parity with Sonnet 4)
- Default ICU plural messages above are starting templates — refine during execution if linguist review reveals nuance

### Deferred Ideas (OUT OF SCOPE)

- POLISH-04 driver mobile app polish (driver = Telegram bot in v1)
- Real-time provider failover (restart-based for v1)
- Multi-provider load-balancing (cost optimization) — v2 PROD-05
- WebSocket reconnect for /ws/inbox + /ws/tracking — v2
- Locale-aware bot reply dates — admin-only is enough
- OpenTelemetry + Grafana observability — v2 PROD-04
- Telegram bot UA/RU language switch UI (sticky lang detect covers)
- i18next migration — over-engineering for v1
- Plural rules for Belarusian/Polish/Kazakh markets — v2
- Video transcoding pipeline (server-side ffmpeg) — manual record-and-bundle fine for v1
- Public-facing analytics for demo — v2
- Pre-flight smoke runs in CI — needs real credentials in CI vault
- POLISH-04 driver-app push notifications — out of v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **I18N-01** | Server-side RU/UA dictionary for ALL bot replies + system messages | Standard Stack §intl-messageformat + Architecture Pattern §1 (extend existing `i18n.ts`) + Code Example §A |
| **I18N-03** | ICU MessageFormat plural rules in admin | Standard Stack §intl-messageformat (verified package name + version) + Architecture Pattern §2 + Code Example §B (CLDR plural rules for RU/UA) + Pitfall §1 |
| **I18N-04** | date-fns/locale ru + uk for admin dates | Standard Stack §date-fns + Architecture Pattern §3 + Code Example §C (import paths verified) + Pitfall §2 (locale tree-shaking) |
| **I18N-05** | Declension-free templates ("Маршрут: {from} → {to}") | Architecture Pattern §1 + Code Example §A + Audit checklist in Wave 1 + Pitfall #15 reference (PITFALLS.md) |
| **NOTIF-01** | Order FSM transition notifications via Telegram | Architecture Pattern §5 (audit existing Phase 3 wiring) + Code Insight §existing-notifications.ts + Validation Architecture (W1 markers) |
| **NOTIF-02** | RU/UA notification templates (NO `/track/[token]`) | Code Insight §existing-i18n.ts (already declension-free) + CI grep guard pattern + Don't Hand-Roll §1 |
| **POLISH-01** | Snapshot tests on 20 canonical inputs | Standard Stack §Vitest + Architecture Pattern §6 (snapshot byte-stability via Mock LLM) + Code Example §D + Pitfall §3 (snapshot determinism) |
| **POLISH-02** | "Simulate inbound call" button | Architecture Pattern §7 (replay pattern reusing Phase 3.1 handlers) + Code Insight §voice-driver.ts + Code Example §E |
| **POLISH-03** | Pre-recorded voice fallback video | Architecture Pattern §8 (Next.js 16 public/ video bundling) + Code Example §F (WebVTT format) + Pitfall §4 (MP4 size budget) |
| **POLISH-05** | Pre-flight checklist script | Architecture Pattern §9 (6 sequential checks via native fetch + SDK pings) + Code Example §G + Don't Hand-Roll §2 |
| **POLISH-06** | LLM_PROVIDER Anthropic↔OpenAI failover | Standard Stack §openai (version pinning warning) + Architecture Pattern §4 (adapter interface) + Code Example §H (tool-call format mapping) + Pitfall §5 (OpenAI tool-use shape drift) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md (root + apps/api + apps/web) encodes these binding directives — research recommendations must conform.

| Constraint | Source | Phase 5 Application |
|------------|--------|---------------------|
| **No floating-point money** — bigint kopecks only | CLAUDE.md core value | OpenAI adapter must NOT use `Number` for prices; reuse `formatPriceKop` (Phase 2) + `priceGuard` regex |
| **LLM in money path FORBIDDEN** | PITFALLS.md Pitfall #1 + CLAUDE.md | OpenAI adapter MUST render prices via templated string from `leads.quoted_price`, never from LLM output; Phase 2 priceGuard re-applied identically |
| **Tools-as-security-boundary** | PROJECT.md + Pitfall #11 | OpenAI adapter MUST consume same Zod schemas as Anthropic; tools re-validate inputs; FSM stage gates `createOrder` |
| **Determinism for `calcPrice` + `extractRequest`** | PITFALLS.md Pitfall #1 + CLAUDE.md "тестируемые, воспроизводимые" | Snapshot tests use frozen `FIXED_NOW` + MockAnthropicClient with `llm-responses.json` fixtures |
| **PostGIS column types unchanged** | DB-04 + STACK.md | Phase 5 ships NO schema migrations |
| **Pin Drizzle version exactly** (no `^`) | STACK.md "known sharp edges" | Phase 5 adds no Drizzle changes |
| **Use Node 22 `--env-file=.env`** | STACK.md | `preflight.ts` runs via `tsx --env-file=../../.env.local` (mirrors `voice-setup.ts`, line 26 of package.json) |
| **No new infra outside docker-compose** | DEPLOY-01 + CONTEXT D-52 | No new services; no new ports; no new dependencies that require system packages |
| **Tailwind v4 — use `border-border` explicitly** | Pitfall #13 + Phase 4 D-58 | New modals (simulate-call, voice-fallback) MUST use `border-border` not bare `border` |
| **page.tsx server / `_components/*.tsx` client** | spec §7.3 + Pitfall #13 + Phase 4 D-59 | `simulate-call-modal.tsx` + `voice-fallback-modal.tsx` are `'use client'`; calls/page.tsx remains Server Component |
| **No `'use cache'` on dynamic pages** | Phase 4 D-12 + Pitfall #13 | `/dashboard/calls` keeps no-cache; new buttons sit in existing `calls-app.tsx` `'use client'` boundary |
| **GSD workflow** | CLAUDE.md GSD section | Phase 5 plans MUST flow through `/gsd:execute-phase`, not raw edits |
| **No emojis in writing unless asked** | Custom instructions | Plan files avoid emojis; UI text already approved per CONTEXT D-30 includes 🎬 / ▶ — those are UX content, not authoring style |

## Standard Stack

### Core (NEW for Phase 5)

| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| **`intl-messageformat`** | **11.2.8** (latest stable per `npm view intl-messageformat dist-tags`) | ICU MessageFormat plural/select parser for RU/UA admin (I18N-03) | Official FormatJS publication. Pulls in `@formatjs/icu-messageformat-parser` 3.5.11 + `@formatjs/fast-memoize` 3.1.6. Runtime ICU evaluation; native CLDR plural rules; no React/Vue lock-in. **CRITICAL: CONTEXT D-12 says `@formatjs/intl-messageformat` — that package does NOT exist. The correct name is `intl-messageformat` (no scope).** |
| **`openai`** | **Pin `4.104.0` exactly OR upgrade to `^6.42.0`** | OpenAI SDK for LLM_PROVIDER failover (POLISH-06) | CONTEXT D-44 says `openai@4.x`. Live registry: `dist-tags.latest = 6.42.0` (June 2026). `^4` resolves correctly to 4.x line; safer is an exact pin. v4 supports `chat.completions.create({ tools, tool_choice })` which matches the adapter contract. **Planner decision needed:** pin `4.104.0` (last 4.x) OR upgrade decision to `^6` and verify Chat Completions still works (it does per OpenAI changelog through 2026). Both are valid. |
| **`date-fns/locale`** | bundled with **`date-fns@4.1.0`** (already installed in `apps/web`) | Russian + Ukrainian locale objects for `format()` in admin (I18N-04) | Already locked in apps/web/package.json. Tree-shakeable: `import { ru } from 'date-fns/locale/ru'` and `import { uk } from 'date-fns/locale/uk'` add ~12-15kb gzipped each (one locale file per language). NO bundle change for unused locales. |

### Supporting (REUSE — already installed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@anthropic-ai/sdk` | 0.102.x | Anthropic adapter (already in `apps/api/package.json`) | Phase 2 |
| `vitest` | 4.1.x | Snapshot tests | Phase 0 / Wave 0 in every phase |
| `fastify` | 5.8.5 | `admin.ts` route plugin | Phase 1 |
| `zod` | 4.4.3 (api) / 4.4.2 (web) | Request body validation on `/api/admin/simulate-call` | Phase 1 |
| Mock harness | `apps/api/tests/_helpers/mock-anthropic.ts` | Snapshot determinism (POLISH-01) | Phase 2 |
| Voice scenarios fixture | `apps/api/tests/fixtures/voice-scenarios.json` | Simulate-call source (POLISH-02) | Phase 3.1 |
| Voice tool handlers | `apps/api/src/channels/voice/tool-handlers.ts` | Replayed by simulate-call | Phase 3.1 |
| `MockTwilioClient` + `replayVoiceScenario` | `apps/api/tests/_helpers/voice-mock.ts` | Test reuse + replay reference | Phase 3.1 |
| `twilio` | 6.0.2 (already installed) | Preflight Twilio number check | Phase 3.1 |
| `@elevenlabs/elevenlabs-js` | 2.52.0 (already installed) | NOT used in Phase 5 (preflight only pings Anthropic LLM key, NOT ElevenLabs per D-34) | Phase 3.1 (informational) |

### Alternatives Considered (and rejected per CONTEXT)

| Instead of | Could Use | Tradeoff | Why Rejected |
|------------|-----------|----------|--------------|
| `intl-messageformat` | `i18next` + `i18next-icu` | Full i18n framework with namespaces, lazy-load | CONTEXT D-12 explicitly rejects (over-engineering for v1; "ICU for plurals only"). i18next adds ~30kb + namespace machinery we don't need. |
| `intl-messageformat` | `@messageformat/core` | Pre-compiled (smaller runtime) | Pre-compile step adds build complexity. Phase 5 has only 5 plural templates × 2 langs = 10 strings — runtime cost is trivial. |
| `date-fns/locale` | `dayjs` + plugins | 2kb base | Already migrated to date-fns in Phase 4 (`format.ts`). Reverting costs 2 days. |
| OpenAI SDK | LiteLLM proxy | Single endpoint, swap providers serverside | Adds a service to docker-compose. CONTEXT D-52 forbids new infrastructure. |
| Native `fetch` for preflight | `node:http` with retries | Lower-level control | Native `fetch` (Node 22) + AbortController has 30s timeout built in. No retries needed (fail-fast per D-34). |
| WebVTT captions | SubRip (.srt) | Wider tooling | HTML5 `<video><track kind="captions">` requires WebVTT per W3C spec. No choice. |

### Installation

```bash
# Workspace root (shared between apps/api + apps/web)
pnpm add -w intl-messageformat@11.2.8

# apps/api (POLISH-06 OpenAI failover)
pnpm --filter @ai-logist/api add openai@4.104.0  # OR openai@^6.42.0 — planner decision

# apps/web — date-fns ALREADY INSTALLED at 4.1.0
# No new web deps; only new locale imports inside existing format.ts
```

### Version Verification (run before plan execution)

```bash
npm view intl-messageformat version       # expect: 11.2.8 (verified 2026-06-11)
npm view openai version                   # expect: 6.42.0 (verified 2026-06-11; planner chooses pin)
npm view date-fns version                 # expect: 4.4.0 (newer than apps/web's 4.1.0 — no upgrade needed)
```

### Adapter Verification (post-install)

```bash
# Verify intl-messageformat default export shape
node -e "import('intl-messageformat').then(m => console.log(typeof m.default, typeof m.IntlMessageFormat))"
# Expected: 'function' 'function'  (default OR named export both work)

# Verify date-fns locale imports
node -e "import('date-fns/locale/ru').then(m => console.log(m.ru.code))"  # expect 'ru'
node -e "import('date-fns/locale/uk').then(m => console.log(m.uk.code))"  # expect 'uk'
```

## Architecture Patterns

### Pattern 1: Extend `apps/api/src/lib/i18n.ts` (I18N-01, I18N-05)

**What:** Add `renderBotReply(key, params, lang)` alongside existing `renderNotificationTemplate`. Add a `BotReplyKey` union covering 11 keys. Move inline RU/UA strings out of `apps/api/src/pipeline/intake.ts` into the dictionary.

**When to use:** All NEW or migrated bot replies in pipeline/intake.ts.

**File structure (target):**
```typescript
// apps/api/src/lib/i18n.ts (extended)
export type BotReplyKey =
  | 'greeting' | 'clarify-route' | 'clarify-tons' | 'clarify-body-type'
  | 'quote-present' | 'confirm-ask' | 'order-confirmed' | 'escalate'
  | 'manager-takeover' | 'manager-handover' | 'budget-exceeded';

interface BotReplyParams {
  greeting: Record<string, never>;
  'clarify-route': Record<string, never>;
  'clarify-tons': Record<string, never>;
  'clarify-body-type': Record<string, never>;
  'quote-present': { from: string; to: string; tons: number; bodyType: string; price: string; currency: string };
  'confirm-ask': Record<string, never>;
  'order-confirmed': { number: string };
  'escalate': Record<string, never>;
  'manager-takeover': Record<string, never>;
  'manager-handover': Record<string, never>;
  'budget-exceeded': Record<string, never>;
}

export function renderBotReply<K extends BotReplyKey>(
  key: K, params: BotReplyParams[K], lang: 'ru' | 'ua'
): string { /* template lookup */ }

// Keep existing renderNotificationTemplate untouched.
```

**Declension-free invariants (I18N-05):**
- `quote-present` uses arrow separator: `"Маршрут: {from} → {to}, {tons}т, {bodyType}. Цена: {price} {currency}."`
- `clarify-route` is "Откуда и куда?" / "Звідки і куди?" — no city interpolation
- DRIVER_ASSIGNED / IN_TRANSIT / DELIVERED — no city interpolation (already correct per Phase 3 source read)

### Pattern 2: ICU helper wrappers (`apps/api/src/lib/icu.ts` + `apps/web/src/lib/i18n/icu.ts`)

**What:** Thin wrapper around `intl-messageformat` that takes message + locale + values, returns formatted string. Cache parser per `(message, locale)` to avoid re-parsing.

**When to use:** Anywhere a dynamic count needs Slavic plural form.

**Example (server-side, but client identical):**
```typescript
// apps/api/src/lib/icu.ts
import IntlMessageFormat from 'intl-messageformat';

const cache = new Map<string, IntlMessageFormat>();

export function formatIcu(
  message: string,
  values: Record<string, string | number>,
  locale: 'ru' | 'ua'
): string {
  // Map 'ua' → 'uk-UA' for CLDR (FormatJS uses BCP-47; CLDR uses 'uk' for Ukrainian)
  const cldrLocale = locale === 'ua' ? 'uk-UA' : 'ru-RU';
  const key = `${cldrLocale}::${message}`;
  let parsed = cache.get(key);
  if (!parsed) {
    parsed = new IntlMessageFormat(message, cldrLocale);
    cache.set(key, parsed);
  }
  const result = parsed.format(values);
  return Array.isArray(result) ? result.join('') : String(result);
}
```

**Critical:** Always pass `'uk-UA'` (not `'ua'`) to `IntlMessageFormat` constructor. CLDR uses `uk` for Ukrainian (Ukrainian language code per ISO 639-1); our app-internal code is `'ua'` (the country code). Mapping happens at the boundary.

### Pattern 3: `formatDateLocale` extension to `apps/web/src/lib/format.ts` (I18N-04)

**What:** Add a new exported function `formatDateLocale(date, lang)` alongside existing `formatDate`. Existing `formatDate` (using `Intl.DateTimeFormat`) is kept — `formatDateLocale` is the new admin-display formatter.

**When to use:** Admin tables, modals, timeline events (date + day-of-week).

**Example:**
```typescript
// apps/web/src/lib/format.ts (extended)
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';

export function formatDateLocale(date: Date | string, lang: 'ru' | 'ua' = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lang === 'ua' ? uk : ru;
  // "8 июн, ср" (RU) / "8 чер, ср" (UA)
  return format(d, 'd MMM, EEE', { locale });
}
```

**Tree-shaking note:** Importing from `date-fns/locale/ru` (NOT `date-fns/locale`) keeps the bundle from pulling all 100+ locales. Phase 4 verified this works with Turbopack via `next build`.

### Pattern 4: LLM provider adapter (`apps/api/src/lib/llm/{provider,anthropic-adapter,openai-adapter}.ts`)

**What:** Adapter pattern matching the existing `LlmProvider` interface in `apps/api/src/pipeline/llm-client.ts` (defined for Phase 2 mock harness). Factory at `provider.ts` returns the adapter; consumer code (`intake.ts`, voice handlers) uses interface only.

**When to use:** Any call site currently invoking Anthropic SDK directly.

**Existing interface (REUSE — DO NOT redesign):**
```typescript
// apps/api/tests/_helpers/mock-anthropic.ts (already in repo, lines 12-22)
export interface LlmProvider {
  runTurn(args: {
    systemPrompt: string;
    userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    toolNames: string[];
  }): Promise<{
    toolCalls: Array<{ name: string; args: unknown }>;
    finalText: string | null;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}
```

**Adapter factory:**
```typescript
// apps/api/src/lib/llm/provider.ts
import type { LlmProvider } from '../../pipeline/llm-client.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';

let singleton: LlmProvider | null = null;
export function getLLMClient(): LlmProvider {
  if (singleton) return singleton;
  const provider = process.env.LLM_PROVIDER ?? 'anthropic';
  singleton = provider === 'openai'
    ? new OpenAIAdapter(process.env.OPENAI_API_KEY!)
    : new AnthropicAdapter(process.env.ANTHROPIC_API_KEY!);
  return singleton;
}
```

**Anti-pattern (per CLAUDE.md core value):** Adapter MUST NOT take `quoted_price` from `toolCalls` and render it in `finalText`. Price rendering stays in `intake.ts` via `priceGuard` (Phase 2). Adapter only transports tool calls.

### Pattern 5: Notification audit (NOT extension) (NOTIF-01 + NOTIF-02)

**What:** Read existing code (`order-fsm.ts`, `notifications.ts`, `i18n.ts`) — assert each of 3 transitions wires correctly. ONLY add code if a transition is missing.

**Audit checklist (Phase 5 plan tasks):**
1. `apps/api/src/pipeline/lifecycle/order-fsm.ts` `ORDER_TRANSITIONS` table — confirm edges: `CREATED→DRIVER_ASSIGNED`, `DRIVER_ASSIGNED→IN_TRANSIT` (or `AT_LOADING→IN_TRANSIT`), `IN_TRANSIT→DELIVERED`. STATE.md notes Plan 03-04 already added `DRIVER_ASSIGNED→CLOSED` edge.
2. For each transition above, confirm `onSuccess` post-commit hook invokes `notifyClient({ orderId, transition, db, bot, log })`.
3. Confirm `notifyClient` source contains no `/track/` or `trackingUrl` substring.
4. Confirm `renderNotificationTemplate` for all 3 transitions × 2 langs renders without throwing.
5. Run CI grep guard from D-03.

**When to extend (NOT typical):** If audit reveals IN_TRANSIT or DELIVERED transitions missing from `ORDER_TRANSITIONS` table OR missing `notifyClient` invocation, plan adds them in the same wave as the audit. Re-use pattern from Plan 03-04 (`onSuccess` post-commit hook).

### Pattern 6: Snapshot testing with byte-stability (POLISH-01)

**What:** Vitest's built-in snapshot serializer + `MockAnthropicClient` from Phase 2 + frozen `FIXED_NOW` from `tests/_helpers/fake-timers.ts`. Snapshot files committed to repo; PR diff that changes them needs explicit `--update` flag review.

**When to use:** `extractRequest` (LLM-driven, mocked) + `calcPrice` (pure deterministic).

**Snapshot file layout (per CONTEXT D-20):**
```
apps/api/tests/snapshots/
├── extract-request.snap.ts
├── calc-price.snap.ts
└── __snapshots__/
    ├── extract-request.snap.ts.snap
    └── calc-price.snap.ts.snap
```

**Note on existing snapshot directory:** Vitest already wrote snapshots to `apps/api/tests/unit/__snapshots__/calc-price.test.ts.snap` and `extract-request.test.ts.snap` during Phase 2. Phase 5's NEW snapshot directory at `apps/api/tests/snapshots/` is separate — these tests are explicit POLISH-01 snapshots that run via `pnpm test:snapshot` (already wired in package.json line 11 as a 10x bash loop for byte-stability verification).

**Pattern (per existing `apps/api/tests/unit/calc-price.test.ts` reference):**
```typescript
// apps/api/tests/snapshots/calc-price.snap.ts (new)
import { describe, expect, it } from 'vitest';
import { calcPrice } from '../../src/pipeline/llm-tools/calc-price.js';
import { FIXED_NOW } from '../_helpers/fake-timers.js';

const FIXED_CONFIG = {
  rate_per_km_kopecks: 4200n,
  dir_coef: { default: 1.0, back_haul: 0.85 },
  season_coef: () => 1.0,
};

describe('snapshot: calcPrice (POLISH-01)', () => {
  it.each([
    ['540km-18t-tent-default', { route_km: 540, tons: 18, bodyType: 'tent', date: FIXED_NOW, direction: 'default' as const }],
    // ...10 combos per D-20
  ])('case %s', (id, input) => {
    expect({ id, output: calcPrice(input, FIXED_CONFIG) }).toMatchSnapshot();
  });
});
```

**For extract-request snapshots:** Inject `MockAnthropicClient` (already exists at `apps/api/tests/_helpers/mock-anthropic.ts`); fixtures already at `apps/api/tests/fixtures/llm-responses.json`. Snapshot the validated ExtractRequestOutput. No live LLM.

### Pattern 7: Replay scenario through tool pipeline (POLISH-02)

**What:** Treat `voice-scenarios.json` entries as a list of `{endpoint, body}` objects; for each entry, call the corresponding voice tool handler directly (in-process, no HTTP). This is the exact pattern Phase 3.1 already uses in `apps/api/tests/_helpers/voice-driver.ts` (`injectVoiceWebhook`) and `voice-mock.ts` (`replayVoiceScenario`).

**When to use:** `POST /api/admin/simulate-call` handler.

**Reuse path (no new helper needed for production code, but borrow pattern):**
- `voice-mock.ts:replayVoiceScenario` — TEST helper, signs HMAC, calls app.inject. Production simulate-call route does NOT need HMAC (it's behind admin auth).
- Production simulate-call route can either:
  - **(A) Direct in-process invocation:** import voice tool handlers from `apps/api/src/channels/voice/tool-handlers.ts`, call each function with mocked req/reply. Cleanest.
  - **(B) Internal app.inject:** use Fastify's `app.inject` to POST to `/webhook/voice/*` endpoints in-process. Mirrors test pattern, but requires HMAC signing inside admin.ts.

**Recommendation: (A).** Direct invocation avoids HMAC complexity and keeps the simulate route synchronous + traceable.

**Skeleton:**
```typescript
// apps/api/src/routes/admin.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  handleExtractRequest, handleNearestTruck, handleCalcPrice,
  handleCreateOrder, handleLangDetected,
} from '../channels/voice/tool-handlers.js';

const SimulateBody = z.object({
  scenarioKey: z.enum([
    'ru_happy_path', 'ua_happy_path', 'injection_attempt',
    'ambiguous_clarification', 'abandon_mid_call',
  ]),
});

const scenariosPath = fileURLToPath(new URL(
  '../../tests/fixtures/voice-scenarios.json', import.meta.url
));
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8'));

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post('/api/admin/simulate-call', async (req, reply) => {
    const body = SimulateBody.parse(req.body);
    const scenario = scenarios[body.scenarioKey];
    // 1. Create fake calls row (audio_url=NULL, transcript: scenario.transcript || [], outcome='completed')
    // 2. Replay scenario.events sequentially through tool-handlers (no HMAC, in-process)
    // 3. Update calls.linked_lead_id
    // 4. Return { callId, leadId, orderId }
  });
}
```

**Production-vs-test fixture location:** `voice-scenarios.json` currently lives under `apps/api/tests/fixtures/` — for the production route to read it, either:
- (A1) Move/copy the file to `apps/api/src/fixtures/voice-scenarios.json` so it's bundled in build output.
- (A2) Use relative path with `import.meta.url` resolution (works in tsx dev; in compiled `dist/` requires copy-on-build step in `tsc -p` config or a postbuild script).

**Recommendation:** Move to `apps/api/src/fixtures/voice-scenarios.json` and keep a re-export symlink or copy in tests/fixtures/ for test reuse. Cleaner.

### Pattern 8: MP4 + WebVTT bundling in Next.js 16 `public/` (POLISH-03)

**What:** Place `voice-fallback.mp4` and `voice-fallback.ru.vtt` in `apps/web/public/demo/`. Next.js serves `public/*` at the root (`/demo/voice-fallback.mp4`). No special config needed. Add `.gitattributes` entry to mark MP4 as binary.

**When to use:** Demo video bundling (POLISH-03).

**File paths:**
- `apps/web/public/demo/voice-fallback.mp4` → URL `/demo/voice-fallback.mp4`
- `apps/web/public/demo/voice-fallback.ru.vtt` → URL `/demo/voice-fallback.ru.vtt`
- `apps/web/public/demo/README.md` (per D-56 — re-recording instructions for team)

**HTML5 video markup (in `voice-fallback-modal.tsx`):**
```tsx
<video
  controls
  preload="metadata"   // Loads headers + first frame only; not full file
  className="w-full rounded-lg border border-border"  // Tailwind v4 explicit border-border
  src="/demo/voice-fallback.mp4"
>
  <track
    kind="captions"
    srcLang="ru"
    src="/demo/voice-fallback.ru.vtt"
    label="Русские субтитры"
    default
  />
  Ваш браузер не поддерживает HTML5 video.
</video>
```

**Critical:** `preload="metadata"` (not `"auto"`) prevents the full ~15MB download on page load. Video only fully loads when user clicks Play. Tested across Chrome/Firefox/Safari per MDN docs.

**`.gitattributes` entry (apps/web/ root):**
```
public/demo/*.mp4 binary
public/demo/*.vtt text eol=lf
```

**Cache-Control:** Next.js 16 serves `public/*` with `Cache-Control: public, max-age=0` by default. For demo this is fine (video changes infrequently); production would use `next.config.ts` `headers()` to set `public, max-age=31536000, immutable` for `/demo/*.mp4`. Not in scope per CONTEXT (no production hardening).

**File size budget enforcement:** Add a pre-commit-time check (or CI guard) that fails if `voice-fallback.mp4` > 15 MB:
```bash
test "$(stat -f%z apps/web/public/demo/voice-fallback.mp4 2>/dev/null || stat -c%s apps/web/public/demo/voice-fallback.mp4)" -lt 15728640 || { echo "voice-fallback.mp4 exceeds 15 MB"; exit 1; }
```

**WebVTT format (basic):**
```
WEBVTT

00:00:00.000 --> 00:00:03.500
Здравствуйте! Это AI-логист.

00:00:03.500 --> 00:00:08.000
Чем могу помочь?
```

### Pattern 9: Pre-flight script (POLISH-05)

**What:** Standalone `tsx` script invoked via `pnpm preflight`. 6 sequential checks (fail-fast). Each check is async, wrapped in try/catch, prints `✓` or `✗`. Exits 0 on success, 1 on any failure.

**Why sequential, not parallel:** D-34 says "fail-fast". Parallel would run all 6 even after first failure — wasteful and confuses output. Sequential prints in order; first ✗ exits 1.

**Skeleton:**
```typescript
// apps/api/scripts/preflight.ts
#!/usr/bin/env tsx
import { Bot } from 'grammy';
import Twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { config } from '../src/config.js';

type Check = { name: string; fn: () => Promise<void> };

const checks: Check[] = [
  { name: 'Telegram bot alive', fn: async () => {
      const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
      const me = await bot.api.getMe();
      if (!me.username) throw new Error('no username returned');
  }},
  { name: 'Twilio number registered', fn: async () => {
      const tw = Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      const nums = await tw.incomingPhoneNumbers.list({ phoneNumber: config.TWILIO_NUMBER });
      if (nums.length === 0) throw new Error(`number ${config.TWILIO_NUMBER} not in account`);
  }},
  { name: 'DB seeded', fn: async () => {
      const pool = new Pool({ connectionString: config.DATABASE_URL });
      const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM trucks WHERE status='available'");
      if (rows[0].n < 10) throw new Error(`only ${rows[0].n} trucks available`);
      await pool.end();
  }},
  { name: '/api/health', fn: async () => {
      const res = await fetch(`${config.API_BASE_URL}/api/health`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json() as { checks: { postgis: string } };
      if (!/^3\.5/.test(json.checks.postgis)) throw new Error(`PostGIS=${json.checks.postgis}`);
  }},
  { name: 'LLM key check', fn: async () => {
      const a = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
      await a.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
  }},
  { name: 'E2E smoke (RU + UA)', fn: async () => {
      for (const key of ['ru_happy_path', 'ua_happy_path']) {
        const res = await fetch(`${config.API_BASE_URL}/api/admin/simulate-call`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenarioKey: key }),
        });
        if (!res.ok) throw new Error(`${key}: status ${res.status}`);
        const { orderId } = await res.json();
        if (!orderId) throw new Error(`${key}: no order created`);
      }
  }},
];

let exitCode = 0;
for (const check of checks) {
  const t0 = Date.now();
  try {
    await check.fn();
    console.log(`✓ ${check.name} (${Date.now() - t0}ms)`);
  } catch (err: any) {
    console.error(`✗ ${check.name}: ${err.message}`);
    exitCode = 1;
    break;  // D-34 fail-fast
  }
}
process.exit(exitCode);
```

**`pnpm preflight` script registration (root `package.json`):**
```json
{
  "scripts": {
    "preflight": "pnpm --filter @ai-logist/api exec tsx --env-file=../../.env.local scripts/preflight.ts"
  }
}
```

**Discretion item (CONTEXT):** `--json` flag for machine output. Recommendation: ADD it. Trivial implementation; useful for future CI automation.

### Recommended Project Structure (additions in Phase 5)

```
apps/
├── api/
│   ├── scripts/
│   │   └── preflight.ts                         # NEW (POLISH-05)
│   ├── src/
│   │   ├── fixtures/
│   │   │   └── voice-scenarios.json             # MOVED from tests/fixtures/ (POLISH-02 prod read)
│   │   ├── lib/
│   │   │   ├── i18n.ts                          # EXTENDED (I18N-01)
│   │   │   ├── icu.ts                           # NEW (I18N-03 wrapper)
│   │   │   └── llm/
│   │   │       ├── provider.ts                  # NEW (POLISH-06 factory)
│   │   │       ├── anthropic-adapter.ts         # NEW (POLISH-06)
│   │   │       └── openai-adapter.ts            # NEW (POLISH-06)
│   │   ├── routes/
│   │   │   └── admin.ts                         # NEW (POLISH-02)
│   │   ├── pipeline/
│   │   │   └── intake.ts                        # MODIFIED (replace inline strings)
│   │   └── app.ts                               # MODIFIED (register adminRoutes + provider)
│   └── tests/
│       ├── snapshots/                           # NEW dir (POLISH-01)
│       │   ├── extract-request.snap.ts
│       │   ├── calc-price.snap.ts
│       │   └── __snapshots__/
│       ├── unit/
│       │   ├── i18n-dict.test.ts                # NEW (D-47)
│       │   ├── icu-plural.test.ts               # NEW (D-47)
│       │   └── llm-provider-adapter.test.ts     # NEW (D-47)
│       └── integration/
│           ├── notif-fsm-transitions.test.ts    # NEW (D-49)
│           └── simulate-call.test.ts            # NEW (D-49)
└── web/
    ├── public/demo/
    │   ├── voice-fallback.mp4                   # NEW binary (POLISH-03)
    │   ├── voice-fallback.ru.vtt                # NEW (POLISH-03)
    │   └── README.md                            # NEW (recording instructions)
    └── src/
        ├── lib/
        │   ├── format.ts                        # MODIFIED (add formatDateLocale)
        │   └── i18n/
        │       ├── dict.ts                      # MODIFIED (add 5 ICU plural keys)
        │       └── icu.ts                       # NEW (client ICU wrapper)
        ├── app/(main)/dashboard/calls/
        │   └── _components/
        │       ├── calls-app.tsx                # MODIFIED (2 new header buttons)
        │       ├── simulate-call-modal.tsx      # NEW (POLISH-02)
        │       └── voice-fallback-modal.tsx     # NEW (POLISH-03)
        └── tests/unit/
            └── format-date-locale.test.ts       # NEW (D-47)
```

### Anti-Patterns to Avoid

- **DON'T write a Markdown table for the ICU plural format in the source** — use the ICU MessageFormat string verbatim per the spec. Pluralizing via switch statements bypasses CLDR and breaks for edge cases (n=21 should map to "few" not "many").
- **DON'T import `date-fns/locale` without a specific locale** — pulls all 100+ locales (~1 MB before tree-shake; the bundler is supposed to tree-shake but Turbopack has known regressions per Pitfall #13).
- **DON'T render notification text in any code path other than `renderNotificationTemplate`** — single source of truth. CI grep guard `grep -rE "Машина назначена|Машину призначено" apps/api/src/ --include="*.ts" | grep -v lib/i18n.ts && exit 1` catches drift.
- **DON'T put LLM-generated text in the simulate-call route's response** — the simulate route runs the SAME `intake.ts` pipeline as real calls; its output goes into `messages` table via the pipeline, not into the HTTP response body.
- **DON'T add a runtime hot-swap for LLM_PROVIDER** — D-42 explicitly says restart-based. Hot-swap requires per-conversation provider stickiness + retry logic that's out of scope.
- **DON'T proxy the voice-fallback video through `/api/*`** — serve directly from Next.js `public/`. Proxying adds Fastify load for static content (~2-3 MB streamed per demo viewing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slavic plural rules (one/few/many) | Custom `switch (n % 10) { case 1: ... }` | `intl-messageformat` with CLDR plural rules | Edge cases (n=11..14 are "many" not "few"; n=111 same). CLDR has 8+ rules per Slavic language; missing one means wrong word in front of buyer. |
| Locale-aware date formatting | Manual `new Date().getMonth()` lookup table | `date-fns/locale/ru` + `date-fns/locale/uk` | Day-of-week abbreviations (ср vs ср), genitive month forms ("8 июн" — abbreviated genitive), nominative-vs-prepositional distinctions per CLDR. Pre-built. |
| ICU parser | Hand-rolled `{n, plural, ...}` regex | `intl-messageformat` | Plural argument parsing, select format, nested formats, escape sequences — months of work to reproduce. |
| OpenAI tool-call → Anthropic format conversion | Skip OpenAI features | `openai` SDK + adapter mapper | OpenAI uses `function.name` + JSON-string `function.arguments` (must JSON.parse); Anthropic uses `name` + parsed `input` object. Mapper is ~30 LOC but must handle malformed JSON gracefully. |
| Twilio number lookup | Custom REST call to Twilio API | `twilio` SDK `incomingPhoneNumbers.list({ phoneNumber })` | Already installed (Phase 3.1). Handles auth, retries, rate limits. |
| WebVTT format | Custom srt-to-vtt converter | Author `.vtt` directly | One file, 20 cues, hand-authored is faster than tooling. |
| Test harness for replay | New driver | Reuse `voice-driver.ts` test pattern + voice tool handlers directly | `voice-driver.ts` (HMAC signing) + `voice-mock.ts` (replayVoiceScenario) ALREADY exist; production simulate-call calls handlers directly without HMAC (admin-auth gated). |
| Video transcoding pipeline | ffmpeg integration | Manual record + commit MP4 | Per CONTEXT D-29 + Deferred. Team records once, commits the file. |
| Pre-flight HTTP retry logic | Retry library | Native `fetch` + AbortController, fail-fast | D-34 is explicit: fail-fast (no retries). 30s total budget. Native fetch is sufficient. |
| Mock Anthropic for snapshot tests | New mock client | REUSE `apps/api/tests/_helpers/mock-anthropic.ts` | Phase 2 already built it; supports keyed fixture lookup; production adapter implements the same `LlmProvider` interface. |

**Key insight:** Phase 5 is delta polish. Almost everything has a precedent — either a Phase 1-4 artifact to reuse or a verified library to invoke. The single area without precedent is the OpenAI adapter (Pattern 4); even that maps to the existing `LlmProvider` interface designed in Phase 2.

## Runtime State Inventory

Phase 5 ships ZERO schema migrations and adds no new tables. However, two runtime concerns matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 5 adds no new schema, no new collections, no new Redis keys. The simulated-call records use existing `calls` table with `audio_url=NULL`. | None — verified by reading CONTEXT D-31 ("NO admin record created" for video) and D-24 (simulated calls = existing schema). |
| Live service config | New env vars at runtime: `LLM_PROVIDER`, `OPENAI_API_KEY`. The Docker container reads these on boot — restart required after change. | Code edit only (config.ts gains 2 optional Zod fields). Document restart procedure in README Demo Day Checklist per D-43. |
| OS-registered state | None — no new pm2 / systemd / Task Scheduler entries. `pnpm preflight` is a script invoked manually, not registered as a cron/service. | None — verified by reading CONTEXT D-33..D-38. |
| Secrets/env vars | `OPENAI_API_KEY` is NEW — must be added to `.env.local` for failover to work. NOT stored anywhere except `.env.local` (which is gitignored per Phase 1 DEPLOY-02). `ANTHROPIC_API_KEY` unchanged. | Add to `.env.example` + document in README. No SOPS / vault changes (project uses plain `.env.local` per STATE.md). |
| Build artifacts | `voice-fallback.mp4` is a binary artifact in `apps/web/public/demo/`. Next.js build copies `public/` verbatim into `.next/static/`. No special build config needed; `tsc` ignores binaries. | None at code level — just commit the binary. `.gitattributes` marks as binary per D-29. |

**Special case — fixture file move (POLISH-02):** If Pattern 7 recommendation accepted (move `voice-scenarios.json` from `tests/fixtures/` to `src/fixtures/`), the fixture is now bundled into production. Test code that imports it must update path. NO data migration — single file move.

## Common Pitfalls

### Pitfall §1: ICU plural locale string mismatch (CLDR `uk` vs app `ua`)

**What goes wrong:** Developer passes `'ua'` to `IntlMessageFormat` constructor. FormatJS doesn't recognize `'ua'` (that's the country code, not language). It falls back to English plural rules → "Найдено 5 машина" instead of "5 машин". Manager sees it in admin during demo prep.

**Why it happens:** Inconsistent terminology. CLDR / BCP-47 uses ISO 639-1 language codes: `ru` for Russian, `uk` for Ukrainian. Our app uses `'ua'` (country code) internally because the original spec section §8 used that convention.

**How to avoid:** Always map at the boundary. Pattern 2's `formatIcu` helper does `lang === 'ua' ? 'uk-UA' : 'ru-RU'`. Test it explicitly: `expect(formatIcu('{n, plural, one {# машина} other {# машин}}', { n: 1 }, 'ua')).toBe('1 машина');`.

**Warning signs:** Plurals look wrong in only one language; FormatJS warning in console about unrecognized locale.

### Pitfall §2: date-fns locale tree-shaking with Turbopack

**What goes wrong:** Developer writes `import { ru, uk } from 'date-fns/locale'` (barrel import). Turbopack — even in Next.js 16 with React 19 — has known regressions in tree-shaking barrel imports of CJS-style indexes. Bundle balloons by ~1 MB.

**Why it happens:** date-fns v4 ships locale as `date-fns/locale/index.js` which re-exports all 100+ locales. Per-locale paths (`date-fns/locale/ru`, `date-fns/locale/uk`) are direct files and tree-shake cleanly.

**How to avoid:** Always use per-locale paths: `import { ru } from 'date-fns/locale/ru'`. Verified in WebSearch confirmation that this is the v3/v4 idiom.

**Warning signs:** `next build` output shows /dashboard pages over 500 KB JS; analyzing chunks reveals `date-fns/locale/<every-language>` entries.

### Pitfall §3: Snapshot non-determinism from timestamp leakage

**What goes wrong:** Snapshot of `extractRequest` output contains a `created_at` field or includes the LLM's `id` from mock metadata. Snapshot passes once, fails on second run because timestamp drifted by 1ms.

**Why it happens:** `MockAnthropicClient` returns fixture data, but `extractRequest` pipeline may stamp a fresh `Date.now()` somewhere. Or snapshot includes auto-generated UUIDs.

**How to avoid:**
1. Use frozen `FIXED_NOW` from existing `apps/api/tests/_helpers/fake-timers.ts` (already loaded as setupFiles in `unit` vitest project per `vitest.config.ts` lines 17-19).
2. Snapshot ONLY the deterministic fields (e.g., `{ from_city, to_city, tons, body_type }` — NOT created_at, NOT id).
3. Run `pnpm test:snapshot` (already in package.json line 11) — runs the test 10× consecutively, fails if any run differs.

**Warning signs:** Snapshot file contains an ISO 8601 timestamp string or `id: 'cuid_...'` field; CI fails on second commit of snapshot.

### Pitfall §4: MP4 size + git LFS not configured

**What goes wrong:** Team records a 60s call at full quality → 80 MB MP4. Committed naively → repo clone time triples. Or committed with `git lfs track "*.mp4"` but `.gitattributes` not set → file lands in regular git, can't be removed cleanly.

**Why it happens:** ffmpeg defaults are high-quality; no project-wide LFS config.

**How to avoid:**
1. Recording recipe in `apps/web/public/demo/README.md`: `ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k -movflags +faststart -t 60 voice-fallback.mp4` — produces ~5-10 MB for 60s at 720p.
2. Pre-commit size check (script in Pattern 8) — fails if MP4 > 15 MB.
3. NO git LFS (not in stack per STACK.md). 15 MB binary in regular git is acceptable per CONTEXT D-29.

**Warning signs:** `git clone` takes >30s; `du -sh .git` exceeds 100 MB.

### Pitfall §5: OpenAI tool-call response shape drift (CRITICAL)

**What goes wrong:** OpenAI returns `tool_calls[0].function.arguments` as a JSON-encoded STRING (per verified WebFetch from developers.openai.com). Adapter mapper forgets to `JSON.parse()` it. Downstream code receives `args: '{"text":"Киев"}'` (string) instead of `{ text: 'Киев' }` (object). Zod schema validation fails or — worse — `extractRequest` silently re-parses the string and works wrong.

**Why it happens:** Anthropic returns `tool_use` content blocks with `input: { ... }` already parsed; OpenAI returns `function.arguments: '...'` stringified. Different APIs, identical-looking field names.

**How to avoid:** Mapper MUST `JSON.parse` arguments and wrap in try/catch:
```typescript
function mapOpenAIToolCall(tc: OpenAITool): { name: string; args: unknown } {
  let args: unknown;
  try {
    args = JSON.parse(tc.function.arguments);
  } catch (err) {
    throw new Error(`OpenAI tool-call arguments not valid JSON: ${tc.function.arguments}`);
  }
  return { name: tc.function.name, args };
}
```

**Warning signs:** Adapter test passes for Anthropic but fails Zod validation for OpenAI on the same input; `extractRequest` returns `{ from_city: null }` consistently from OpenAI.

### Pitfall §6: `intl-messageformat` cache memory leak

**What goes wrong:** Pattern 2's `cache` Map grows unbounded — every unique `(message, locale)` pair adds an `IntlMessageFormat` instance. In long-running Fastify process serving many requests with templated messages, memory grows over days.

**Why it happens:** Naive cache without eviction.

**How to avoid:** For Phase 5 v1 with 5 fixed templates × 2 langs = 10 cache entries — leak is irrelevant. Document the limit; v2 can swap to LRU.

**Warning signs:** Cache size grows; memory profile shows `IntlMessageFormat` instance count climbing.

### Pitfall §7: Voice-scenarios.json fixture moved but tests still import old path

**What goes wrong:** Pattern 7 recommends moving `voice-scenarios.json` to `src/fixtures/`. Existing Phase 3.1 tests (`voice-mock.ts:replayVoiceScenario`) import the old path.

**Why it happens:** File move without grep audit.

**How to avoid:**
```bash
grep -rl "tests/fixtures/voice-scenarios" apps/api/
# Update all imports OR keep a symlink at old location
```

**Warning signs:** Phase 3.1 voice tests start failing after Phase 5 plan execution.

## Code Examples

### Example A: Server-side dictionary (i18n.ts extension)

```typescript
// apps/api/src/lib/i18n.ts (added below existing code)
// Source: pattern derived from existing renderNotificationTemplate (verified by reading file 2026-06-11)

import { formatIcu } from './icu.js';

export type BotReplyKey =
  | 'greeting' | 'clarify-route' | 'clarify-tons' | 'clarify-body-type'
  | 'quote-present' | 'confirm-ask' | 'order-confirmed' | 'escalate'
  | 'manager-takeover' | 'manager-handover' | 'budget-exceeded';

interface ReplyParams {
  greeting: Record<string, never>;
  'clarify-route': Record<string, never>;
  'clarify-tons': Record<string, never>;
  'clarify-body-type': Record<string, never>;
  'quote-present': { from: string; to: string; tons: number; bodyType: string; price: string; currency: string };
  'confirm-ask': Record<string, never>;
  'order-confirmed': { number: string };
  'escalate': Record<string, never>;
  'manager-takeover': Record<string, never>;
  'manager-handover': Record<string, never>;
  'budget-exceeded': Record<string, never>;
}

// All declension-free (I18N-05). Numerical params come from DB row.
const REPLIES: Record<'ru' | 'ua', Record<BotReplyKey, string>> = {
  ru: {
    greeting: 'Здравствуйте! Я AI-логист. Опишите груз: откуда, куда, сколько тонн, тип кузова.',
    'clarify-route': 'Откуда и куда везти?',
    'clarify-tons': 'Сколько тонн груза?',
    'clarify-body-type': 'Какой тип кузова нужен — тент, реф, изотерм, контейнер?',
    'quote-present': 'Маршрут: {from} → {to}, {tons}т, {bodyType}. Цена: {price} {currency}.',
    'confirm-ask': 'Подтвердите заказ?',
    'order-confirmed': 'Заказ {number} оформлен. Ждите водителя.',
    escalate: 'Передаю менеджеру.',
    'manager-takeover': 'Менеджер на связи.',
    'manager-handover': 'Менеджер передал бота. Можете продолжить.',
    'budget-exceeded': 'Превышен лимит обращений. Передаю менеджеру.',
  },
  ua: {
    greeting: 'Вітаю! Я AI-логіст. Опишіть вантаж: звідки, куди, скільки тонн, тип кузова.',
    'clarify-route': 'Звідки і куди везти?',
    'clarify-tons': 'Скільки тонн вантажу?',
    'clarify-body-type': 'Який тип кузова потрібен — тент, реф, ізотерм, контейнер?',
    'quote-present': 'Маршрут: {from} → {to}, {tons}т, {bodyType}. Ціна: {price} {currency}.',
    'confirm-ask': 'Підтверджуєте замовлення?',
    'order-confirmed': 'Замовлення {number} оформлено. Чекайте водія.',
    escalate: 'Передаю менеджеру.',
    'manager-takeover': 'Менеджер на зв\'язку.',
    'manager-handover': 'Менеджер передав бота. Можете продовжити.',
    'budget-exceeded': 'Перевищено ліміт звернень. Передаю менеджеру.',
  },
};

export function renderBotReply<K extends BotReplyKey>(
  key: K,
  params: ReplyParams[K],
  lang: 'ru' | 'ua'
): string {
  const template = REPLIES[lang][key];
  // Plain `{name}` substitution; no ICU needed for v1 bot replies (D-15).
  return Object.keys(params as object).reduce(
    (s, k) => s.replaceAll(`{${k}}`, String((params as Record<string, unknown>)[k])),
    template
  );
}
```

### Example B: ICU plural usage (admin)

```typescript
// apps/web/src/lib/i18n/dict.ts (extended)
// Source: D-13 — verified plural categories against CLDR for ru + uk

export const pluralTemplates = {
  ru: {
    'fleet.foundTrucks': '{n, plural, one {# машина} few {# машины} many {# машин}}',
    'kpi.orders': '{n, plural, one {# заказ} few {# заказа} many {# заказов}}',
    'kpi.calls': '{n, plural, one {# звонок} few {# звонка} many {# звонков}}',
    'kpi.messages': '{n, plural, one {# сообщение} few {# сообщения} many {# сообщений}}',
    'quote.tons': '{n, plural, one {# тонна} few {# тонны} many {# тонн}}',
  },
  ua: {
    'fleet.foundTrucks': '{n, plural, one {# машина} few {# машини} many {# машин}}',
    'kpi.orders': '{n, plural, one {# замовлення} few {# замовлення} many {# замовлень}}',
    'kpi.calls': '{n, plural, one {# дзвінок} few {# дзвінка} many {# дзвінків}}',
    'kpi.messages': '{n, plural, one {# повідомлення} few {# повідомлення} many {# повідомлень}}',
    'quote.tons': '{n, plural, one {# тонна} few {# тонни} many {# тонн}}',
  },
} as const;

// Source: pattern verified against intl-messageformat README (npm view 11.2.8)
// apps/web/src/lib/i18n/icu.ts
import IntlMessageFormat from 'intl-messageformat';

const cache = new Map<string, IntlMessageFormat>();

export function formatPlural(template: string, n: number, lang: 'ru' | 'ua'): string {
  const cldrLocale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const key = `${cldrLocale}::${template}`;
  let imf = cache.get(key);
  if (!imf) {
    imf = new IntlMessageFormat(template, cldrLocale);
    cache.set(key, imf);
  }
  const result = imf.format({ n });
  return Array.isArray(result) ? result.join('') : String(result);
}

// Usage in a component (must be 'use client' if reading from zustand):
// formatPlural(pluralTemplates.ru['fleet.foundTrucks'], 5, 'ru') → "5 машин"
// formatPlural(pluralTemplates.ru['fleet.foundTrucks'], 21, 'ru') → "21 машина"
```

### Example C: date-fns locale (verified import paths)

```typescript
// apps/web/src/lib/format.ts (extended; existing functions kept)
// Source: WebSearch + date-fns v4 changelog verified 2026-06-11
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';   // ~12 KB gzipped
import { uk } from 'date-fns/locale/uk';   // ~12 KB gzipped

export function formatDateLocale(date: Date | string, lang: 'ru' | 'ua' = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lang === 'ua' ? uk : ru;
  // "8 июн, ср" (RU) — d + abbreviated month + day-of-week
  // "8 чер, ср" (UA) — same shape
  return format(d, 'd MMM, EEE', { locale });
}

export function formatDateTimeLocale(date: Date | string, lang: 'ru' | 'ua' = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lang === 'ua' ? uk : ru;
  // "8 июн, ср 14:30" / "8 чер, ср 14:30"
  return format(d, 'd MMM, EEE HH:mm', { locale });
}
```

**Bundle impact (verified):** Each locale file is ~12-15 KB gzipped. Two locales = ~25-30 KB added to the admin bundle. Negligible. The 200kb "savings" mentioned in CONTEXT D-18 refers to NOT importing the full locale barrel (which would pull all 100+).

### Example D: Snapshot test for calcPrice

```typescript
// apps/api/tests/snapshots/calc-price.snap.ts
// Source: pattern derived from existing apps/api/tests/unit/calc-price.test.ts (read 2026-06-11)
import { describe, expect, it } from 'vitest';
import { calcPrice, type PricingConfig } from '../../src/pipeline/llm-tools/calc-price.js';
import { FIXED_NOW } from '../_helpers/fake-timers.js';

const FIXED_CONFIG: PricingConfig = {
  rate_per_km_kopecks: 4200n,
  dir_coef: { default: 1.0, back_haul: 0.85 },
  season_coef: () => 1.0,
};

// 10 cases per D-20 — sampled across route_km × tons × body_type × direction
const CASES = [
  { id: '540km-18t-tent-default', route_km: 540, tons: 18, bodyType: 'tent' as const, direction: 'default' as const },
  { id: '540km-18t-ref-backhaul', route_km: 540, tons: 18, bodyType: 'ref' as const, direction: 'back_haul' as const },
  { id: '1200km-20t-container-default', route_km: 1200, tons: 20, bodyType: 'container' as const, direction: 'default' as const },
  { id: '100km-5t-iso-default', route_km: 100, tons: 5, bodyType: 'iso' as const, direction: 'default' as const },
  { id: '0.5km-1t-tent-default', route_km: 0.5, tons: 1, bodyType: 'tent' as const, direction: 'default' as const },
  { id: '2000km-25t-tent-default', route_km: 2000, tons: 25, bodyType: 'tent' as const, direction: 'default' as const },
  { id: '300km-10t-tent-default', route_km: 300, tons: 10, bodyType: 'tent' as const, direction: 'default' as const },
  { id: '800km-15t-ref-default', route_km: 800, tons: 15, bodyType: 'ref' as const, direction: 'default' as const },
  { id: '450km-12t-iso-backhaul', route_km: 450, tons: 12, bodyType: 'iso' as const, direction: 'back_haul' as const },
  { id: '1500km-22t-container-default', route_km: 1500, tons: 22, bodyType: 'container' as const, direction: 'default' as const },
];

describe('snapshot: calcPrice — POLISH-01 byte stability', () => {
  for (const c of CASES) {
    it(`case ${c.id}`, () => {
      const out = calcPrice(
        { route_km: c.route_km, tons: c.tons, bodyType: c.bodyType, date: FIXED_NOW, direction: c.direction },
        FIXED_CONFIG
      );
      // Snapshot only deterministic numeric output (kopecks corridor + default).
      // BigInt rendered as string to avoid JSON serialization issues.
      expect({
        id: c.id,
        default: out.default.toString(),
        min: out.min.toString(),
        max: out.max.toString(),
      }).toMatchSnapshot();
    });
  }
});
```

**Run via:** `pnpm --filter @ai-logist/api test:snapshot` (10× consecutive per package.json line 11).

### Example E: Simulate-call route skeleton

```typescript
// apps/api/src/routes/admin.ts (NEW)
// Source: derives from voice-driver.ts pattern (read 2026-06-11) + tool-handlers.ts (Phase 3.1)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const SimulateBodySchema = z.object({
  scenarioKey: z.enum([
    'ru_happy_path', 'ua_happy_path',
    'injection_attempt', 'ambiguous_clarification', 'abandon_mid_call',
  ]),
});

type SimulateBody = z.infer<typeof SimulateBodySchema>;

// Move voice-scenarios.json into src/fixtures/ per Pattern 7 — bundled in prod build.
const scenariosPath = fileURLToPath(new URL('../fixtures/voice-scenarios.json', import.meta.url));
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8')) as Record<string, ScenarioEvent[]>;

interface ScenarioEvent {
  endpoint: string;
  body: Record<string, unknown>;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post<{ Body: SimulateBody }>('/api/admin/simulate-call', async (req, reply) => {
    const body = SimulateBodySchema.parse(req.body);
    const scenario = scenarios[body.scenarioKey];

    // 1. Create fake calls row (audio_url=NULL, outcome='completed')
    //    Use existing callsRepo.insert() — Phase 3.1 schema unchanged.
    // 2. Drive each event through voice tool handler in-process.
    //    Reuse: apps/api/src/channels/voice/tool-handlers.ts (Phase 3.1)
    //    Skip HMAC (admin-auth gated; not external webhook).
    // 3. Update calls.linked_lead_id = createdLeadId
    // 4. Return { callId, leadId, orderId }

    // Implementation details left to plan — Wave 3 in validation arch.
    return reply.send({ callId: '...', leadId: '...', orderId: '...' });
  });
}
```

### Example F: WebVTT captions file

```vtt
WEBVTT

00:00:00.000 --> 00:00:03.500
Здравствуйте! Это AI-логист. Чем могу помочь?

00:00:03.500 --> 00:00:08.000
Здравствуйте, нужно отвезти груз Киев-Львов, 18 тонн, тент.

00:00:08.000 --> 00:00:11.500
Принято: Киев → Львов, 18 тонн, тент. Подбираю машину.

00:00:11.500 --> 00:00:18.000
Машина MAN TGX найдена в 12 километрах. Цена: 22 700 рублей. Подтверждаете?

00:00:18.000 --> 00:00:21.000
Да, оформляйте.

00:00:21.000 --> 00:00:25.000
Заказ KU-4471 оформлен. Водитель свяжется через час.
```

**Encoding:** UTF-8, Unix line endings (LF). Place at `apps/web/public/demo/voice-fallback.ru.vtt`. The `.gitattributes` entry `*.vtt text eol=lf` enforces.

### Example G: OpenAI tool-call mapper (the high-risk part of POLISH-06)

```typescript
// apps/api/src/lib/llm/openai-adapter.ts (NEW)
// Source: WebFetch developers.openai.com/api/docs/guides/function-calling (verified 2026-06-11)
import OpenAI from 'openai';
import type { LlmProvider } from '../../pipeline/llm-client.js';

export class OpenAIAdapter implements LlmProvider {
  private client: OpenAI;
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async runTurn(args: Parameters<LlmProvider['runTurn']>[0]): ReturnType<LlmProvider['runTurn']> {
    // Build OpenAI tools array from toolNames — load from same Phase 2 tool registry.
    const tools = await loadOpenAIToolDefs(args.toolNames);  // helper translates Zod → JSON Schema

    const completion = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: args.systemPrompt },
        ...args.userMessages.map(m => ({ role: m.role, content: m.content })),
      ],
      tools,
      tool_choice: 'auto',
    });

    const msg = completion.choices[0]?.message;
    if (!msg) throw new Error('OpenAI: empty response');

    const toolCalls = (msg.tool_calls ?? []).map(tc => {
      // CRITICAL — OpenAI returns function.arguments as JSON STRING; must parse.
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        throw new Error(`OpenAI tool args not JSON: ${tc.function.arguments}`);
      }
      return { name: tc.function.name, args: parsedArgs };
    });

    return {
      toolCalls,
      finalText: msg.content ?? null,
      usage: {
        input_tokens: completion.usage?.prompt_tokens ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  }
}
```

**Anthropic adapter is simpler** — Anthropic's `input` field on `tool_use` content blocks is already a parsed object. The mapper just renames fields.

### Example H: Preflight bash output target

```
$ pnpm preflight
✓ Telegram bot alive (180ms)
✓ Twilio number registered (420ms)
✓ DB seeded (15ms)
✓ /api/health (8ms)
✓ LLM key check (1240ms)
✓ E2E smoke (RU + UA) (3850ms)

All 6 checks passed in 5713ms. Demo green-light. ✓
```

vs failure mode:

```
$ pnpm preflight
✓ Telegram bot alive (180ms)
✓ Twilio number registered (420ms)
✓ DB seeded (15ms)
✗ /api/health: PostGIS=3.4.2

Preflight failed at check 4 of 6. Fix and re-run.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@formatjs/intl-messageformat` (old npm name in older docs) | `intl-messageformat` (current canonical) | ~2021 — FormatJS published the package under the unscoped name as the user-facing module; scoped packages reserved for sub-modules | CONTEXT D-12 needs correction — see Standard Stack |
| OpenAI Chat Completions API | OpenAI Responses API | OpenAI announced shift in 2025; Chat Completions still supported through 2026 | Phase 5 uses Chat Completions (compatible with both v4.x and v6.x SDK). Responses API is a v2 concern. |
| `useFormatter()` from react-intl for plurals | Raw `IntlMessageFormat` | always-was; react-intl is for full app-level i18n | We don't need react-intl; raw IntlMessageFormat is the right tool for 5 plural strings. |
| Manual locale tables for date formatting | `date-fns/locale/<lang>` | always-was for date-fns | No change. |
| Vitest workspace `projects` config (v3) | Vitest 4 `projects` (same key, but no longer marked deprecated) | Vitest 4.x | Already using v4 per `apps/api/package.json` + `vitest.config.ts`. |

**Deprecated/outdated:**
- `i18next-icu` — for full i18next migration; not needed for Phase 5
- OpenAI Assistants API — to be shut down Aug 2026 per OpenAI changelog; do not use
- `intl-messageformat-parser` (separate npm package) — folded into FormatJS scope; transitively pulled by `intl-messageformat@11`

## Open Questions

1. **Should the OpenAI SDK pin be `4.104.0` or `^6.42.0`?**
   - **What we know:** Both work for Chat Completions tool-use. v6 is current; v4 matches CONTEXT D-44 literal text.
   - **What's unclear:** Whether team prefers paragraph-of-the-spec literal interpretation (4.x) or modern dist-tag (6.x).
   - **Recommendation:** Plan writes `openai@4.104.0` (exact pin, last 4.x release) to honor CONTEXT D-44 verbatim while avoiding silent upgrade. If we ever need Responses API, swap to v6 then.

2. **Should `voice-scenarios.json` live in `apps/api/src/fixtures/` (production) or `apps/api/tests/fixtures/` (tests only)?**
   - **What we know:** Production simulate-call must read it; tests already read from `tests/fixtures/`.
   - **What's unclear:** Whether Phase 3.1 tests should also update path or keep duplicate.
   - **Recommendation:** Move to `src/fixtures/`, update Phase 3.1 test imports (one-line grep + replace), single source of truth.

3. **Should bot reply ICU helper be shipped now (D-15 says "doesn't use it yet")?**
   - **What we know:** D-15 says infrastructure stays inert.
   - **What's unclear:** Whether to add `formatIcu` helper to `apps/api/src/lib/icu.ts` despite no callers.
   - **Recommendation:** YES — the icu.ts file ships with helper because the test `icu-plural.test.ts` covers both server + client invocations (D-47). Server-side `icu.ts` is a thin re-export of identical client-side logic.

4. **WebVTT UA captions: ship or defer?**
   - **What we know:** D-32 says "UA optional".
   - **What's unclear:** Whether demo audience is mixed-language.
   - **Recommendation:** Plan includes UA captions stub (`voice-fallback.ua.vtt`) as 5-minute add. README explains how to swap.

5. **Should `pnpm preflight` exit early on first failure (fail-fast per D-34) or run all checks then summarize?**
   - **What we know:** D-34 says fail-fast.
   - **What's unclear:** Demo operator might want "all results at once" for triage.
   - **Recommendation:** Honor D-34 literally — break on first fail. Operator re-runs after fix; total runtime budget remains ≤30s.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend + Frontend | ✓ (assumed — Phase 1 prerequisite) | 22 LTS | — |
| pnpm | Install + run scripts | ✓ | 9.x | — |
| Docker + Compose | docker-compose stack | ✓ | — | — |
| PostgreSQL 17 + PostGIS 3.5 | Already running | ✓ | postgis/postgis:17-3.5 | — |
| Redis 7.4 | FSM state | ✓ | — | — |
| Anthropic API key (`ANTHROPIC_API_KEY`) | Existing LLM path + LLM key check in preflight | ✓ | — | — |
| OpenAI API key (`OPENAI_API_KEY`) | POLISH-06 failover ONLY | **Optional — set only if testing failover** | — | If absent, `LLM_PROVIDER=openai` startup fails (Zod validation) — that IS the fallback; demo operator either swaps Anthropic OR provides OpenAI key |
| Twilio account credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER`) | Preflight Twilio check | ✓ (already configured in Phase 3.1) | — | If absent, preflight Twilio check fails — operator informed. |
| Telegram bot token (`TELEGRAM_BOT_TOKEN`) | Preflight Telegram check + notifications | ✓ (already configured in Phase 3) | — | If absent, preflight fails. |
| `ffmpeg` (one-time, for recording fallback video) | POLISH-03 recording (NOT runtime) | Manual install — runtime doesn't need it | — | Team records on personal machine; `apps/web/public/demo/README.md` documents install. |

**Missing dependencies with no fallback:** None for runtime. Preflight failures are by design (D-34 fail-fast).

**Missing dependencies with fallback:** OpenAI is optional; if absent, demo runs entirely on Anthropic.

## Validation Architecture

> Phase 5 has `nyquist_validation` enabled (verified by reading `.planning/config.json` — `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (apps/api + apps/web) — same major across monorepo |
| Config file (api) | `apps/api/vitest.config.ts` — 3 projects (unit / integration / smoke); setupFiles fake-timers for unit |
| Config file (web) | `apps/web/vitest.config.ts` (already exists per Phase 4) — happy-dom env, RTL helpers |
| Quick run command | `pnpm --filter @ai-logist/api test:unit` (~10-15s) |
| Full suite command | `pnpm --filter @ai-logist/api test && pnpm --filter @ai-logist/web test` |
| Snapshot stability gate | `pnpm --filter @ai-logist/api test:snapshot` (10× consecutive) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| I18N-01 | renderBotReply produces correct 22 templates; no `/track/` substring; no inline strings remain in intake.ts | unit | `pnpm --filter @ai-logist/api test:unit -t i18n-dict` | ❌ Wave 0 |
| I18N-03 | ICU plural 60 assertions (5 templates × 6 n-values × 2 langs) match CLDR rules | unit | `pnpm --filter @ai-logist/api test:unit -t icu-plural` | ❌ Wave 0 |
| I18N-04 | `formatDateLocale(date, 'ru')` returns "8 июн, ср"; `('ua')` returns "8 чер, ср" | unit | `pnpm --filter @ai-logist/web test -t format-date-locale` | ❌ Wave 0 |
| I18N-05 | All notification + bot reply templates audited for declined city forms; arrow separator enforced | unit (grep guard) | `grep -rE "из \\{from\\}\\|в \\{to\\}\\|у \\{to\\}" apps/api/src/lib/i18n.ts && exit 1` | ❌ Wave 0 |
| NOTIF-01 | Each ORDER_TRANSITION (DRIVER_ASSIGNED/IN_TRANSIT/DELIVERED) wired to notifyClient post-commit | integration | `pnpm --filter @ai-logist/api test:integration -t notif-fsm-transitions` | ❌ Wave 0 |
| NOTIF-02 | No `/track/` substring anywhere in i18n.ts notification block | unit (grep guard) | `grep -E "/track/\\|trackingUrl\\|public_token" apps/api/src/lib/i18n.ts && exit 1 \\|\\| exit 0` | ❌ Wave 0 |
| POLISH-01 | 20 canonical inputs → byte-stable extractRequest + 10 calcPrice cases → byte-stable snapshots over 10 runs | snapshot (unit) | `pnpm --filter @ai-logist/api test:snapshot` | ❌ Wave 0 |
| POLISH-02 | POST /api/admin/simulate-call with each of 5 scenarios → call+lead+order created | integration | `pnpm --filter @ai-logist/api test:integration -t simulate-call` | ❌ Wave 0 |
| POLISH-03 | `voice-fallback.mp4` exists, ≤15MB, valid MP4 header; `voice-fallback.ru.vtt` valid WebVTT | unit (file existence + size + signature) | `pnpm --filter @ai-logist/web test -t voice-fallback-asset` | ❌ Wave 0 |
| POLISH-05 | preflight.ts exits 0 when all 6 checks pass; exits 1 + breaks loop on first failure | manual-only (uses real Telegram + Twilio credentials) | `pnpm preflight` (manual run) | ❌ Wave 0 (script exists check only) |
| POLISH-06 | OpenAIAdapter + AnthropicAdapter produce same LlmProvider output for same mocked input; tool_call args JSON.parsed | unit | `pnpm --filter @ai-logist/api test:unit -t llm-provider-adapter` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-logist/api test:unit` (api unit) AND `pnpm --filter @ai-logist/web test` (web unit) — runs in < 30s combined
- **Per wave merge:** `pnpm --filter @ai-logist/api test && pnpm --filter @ai-logist/web test` (integration + unit + smoke); `pnpm --filter @ai-logist/api test:snapshot` (10× stability)
- **Phase gate:** Full suite green + snapshot stability green + grep guards green + `pnpm preflight` green (manual run, see HUMAN-UAT-06.md) before `/gsd:verify-work`

### Wave 0 Gaps

The phase-5-stubs file establishes the verifier monotonic chain. Marker count must decrease monotonically: **11 (W0) → 11 (W1) → 8 (W2) → 4 (W3) → 1 (W4) → 0 (W5)**. (See "Wave-by-wave marker chain" below for exact breakdown.)

- [ ] `apps/api/tests/unit/phase-5-stubs.test.ts` — 11 `test.todo()` markers (one per req: I18N-01, I18N-03, I18N-04, I18N-05, NOTIF-01, NOTIF-02, POLISH-01, POLISH-02, POLISH-03, POLISH-05, POLISH-06)
- [ ] `apps/api/tests/unit/i18n-dict.test.ts` — covers I18N-01 (22 templates × 2 langs); 1 stub marker
- [ ] `apps/api/tests/unit/icu-plural.test.ts` — covers I18N-03 (60 assertions); 1 stub marker
- [ ] `apps/api/tests/unit/llm-provider-adapter.test.ts` — covers POLISH-06 (adapter parity); 1 stub marker
- [ ] `apps/api/tests/snapshots/extract-request.snap.ts` + `calc-price.snap.ts` — covers POLISH-01; 2 stub markers (one per snap file)
- [ ] `apps/api/tests/integration/notif-fsm-transitions.test.ts` — covers NOTIF-01 + NOTIF-02; 1 stub marker
- [ ] `apps/api/tests/integration/simulate-call.test.ts` — covers POLISH-02; 1 stub marker
- [ ] `apps/web/tests/unit/format-date-locale.test.ts` — covers I18N-04; 1 stub marker
- [ ] `apps/web/tests/unit/voice-fallback-asset.test.ts` — covers POLISH-03 (file size + MP4 header signature + WebVTT validity); 1 stub marker
- [ ] `apps/api/tests/unit/preflight-script-shape.test.ts` — covers POLISH-05 (script exists, exports check fns, exit codes) WITHOUT running real API calls; 1 stub marker
- [ ] `apps/api/tests/unit/declension-grep.test.ts` — covers I18N-05 (grep guard for "из {from}" / "в {to}" / "у {to}" patterns); 1 stub marker
- [ ] Framework install: NONE — vitest 4 + happy-dom + RTL all installed from Phase 4 Wave 0

### Wave-by-wave marker chain (monotonic verifier baseline)

| Wave | Plan focus | Markers flipped this wave | Cumulative remaining |
|------|------------|---------------------------|----------------------|
| W0 | Test infra + 11 stub markers seeded | 0 | **11** |
| W1 | NOTIF audit (NOTIF-01 + NOTIF-02) + I18N-01 server dict + I18N-05 declension audit | 0 (audit-only wave) | **11** |
| W2 | I18N-01 dict.ts wire + I18N-03 ICU + I18N-04 date-fns | 3 flipped (I18N-01, I18N-03, I18N-04) | **8** |
| W3 | NOTIF-01/-02 wire + I18N-05 grep + POLISH-01 snapshots | 4 flipped (NOTIF-01, NOTIF-02, I18N-05, POLISH-01) | **4** |
| W4 | POLISH-02 simulate + POLISH-06 adapter + POLISH-05 preflight | 3 flipped (POLISH-02, POLISH-06, POLISH-05) | **1** |
| W5 | POLISH-03 video bundling + HUMAN-UAT-06 + README | 1 flipped (POLISH-03) | **0** |

The 11→0 sequence is the verifier baseline. Phase 5 plans must not introduce new `test.todo()` markers OUTSIDE this chain.

## Sources

### Primary (HIGH confidence)

- npm registry — `npm view intl-messageformat dist-tags` → 11.2.8 latest (verified 2026-06-11)
- npm registry — `npm view openai dist-tags` → 6.42.0 latest (verified 2026-06-11)
- npm registry — `npm view date-fns version` → 4.4.0 latest (verified 2026-06-11)
- [FormatJS IntlMessageFormat docs](https://formatjs.github.io/docs/intl-messageformat/) — constructor signature, format method, plural usage
- [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling) — tool_calls response shape (id, type, function.name, function.arguments JSON-stringified)
- [date-fns I18n discussions on GitHub + DigitalOcean tutorial](https://github.com/orgs/date-fns/discussions/2724) — v4 locale per-path import pattern verified
- Project source files (read 2026-06-11):
  - `apps/api/src/lib/i18n.ts` — existing renderNotificationTemplate signature
  - `apps/api/src/channels/telegram/notifications.ts` — notifyClient post-commit hook
  - `apps/api/tests/_helpers/mock-anthropic.ts` — LlmProvider interface (Phase 2)
  - `apps/api/tests/_helpers/voice-driver.ts` — Phase 3.1 replay pattern
  - `apps/api/tests/fixtures/{canonical-inputs,voice-scenarios}.json` — POLISH-01 + POLISH-02 sources
  - `apps/web/src/lib/{format,i18n/dict}.ts` — Phase 4 patterns to extend
  - `apps/api/vitest.config.ts` — projects config (unit/integration/smoke), fake-timers setup
  - `apps/api/package.json` — `test:snapshot` 10× loop script (line 11)
  - `apps/web/package.json` — date-fns 4.1.0 already installed
  - `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence — verified against multiple sources)

- WebSearch: "openai node sdk v4 vs v5 vs v6" — confirms Chat Completions still works in all three; Responses API is the modern path but optional
- WebSearch: "intl-messageformat vs @formatjs/intl-messageformat" — confirms `intl-messageformat` is canonical npm name; `@formatjs/intl-messageformat` does NOT exist
- WebSearch: "date-fns v4 locale ru uk" — per-locale paths confirmed (`date-fns/locale/ru`, `date-fns/locale/uk`)

### Tertiary (LOW confidence — flagged for plan-time verification)

- Exact bundle size of `intl-messageformat` 11.2.8 — varies by bundler. Pattern 2 cache makes runtime cost ~negligible.
- Whether Turbopack tree-shakes `date-fns/locale` barrel imports — Phase 4 D-58/59 grep guards catch the regression empirically.
- OpenAI Responses API future-proofing — out of scope for Phase 5.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack (libraries + versions) | HIGH | npm registry verified live; project source read; one correction (D-12 package name) flagged |
| Architecture Patterns | HIGH | Patterns derived from existing Phase 1-4 source code (read 2026-06-11) — not invented |
| Anti-pitfalls | HIGH (5 of 7) / MEDIUM (2 of 7 — ICU cache leak + fixture-move audit are mostly forward-looking) | Cross-validated against PITFALLS.md; specific to Phase 5 deltas |
| OpenAI adapter shape | MEDIUM | OpenAI Tool Calls response shape verified against official docs (developers.openai.com); not against live SDK call. Plan should add a smoke unit test that exercises the mapper with a recorded OpenAI response payload. |
| Snapshot stability mechanism | HIGH | Existing `apps/api/tests/unit/calc-price.test.ts` pattern shows `FIXED_NOW` + 10× bash loop already wired in package.json (line 11) |
| Preflight script shape | HIGH | Native fetch + AbortController is Node 22 stdlib; `twilio`, `grammy`, `@anthropic-ai/sdk`, `pg` SDKs already installed |
| MP4 + WebVTT bundling | HIGH | HTML5 video + `<track>` is W3C spec; Next.js public/ serving is documented |
| Validation architecture | HIGH | mirrors Phase 3.1 + Phase 4 W0 marker-chain pattern (confirmed by STATE.md descriptions of monotonic counts) |

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (30 days for stable; intl-messageformat + openai both have ~monthly release cadence — re-verify versions if planning is delayed past 2 weeks)

---

*Research for: Phase 5 — Demo Polish + Notifications + Final i18n*
*Author: gsd-researcher*
*Phase requirements covered: I18N-01, I18N-03, I18N-04, I18N-05, NOTIF-01, NOTIF-02, POLISH-01, POLISH-02, POLISH-03, POLISH-05, POLISH-06 (10/10)*
