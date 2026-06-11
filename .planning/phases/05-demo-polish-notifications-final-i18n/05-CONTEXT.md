# Phase 5: Demo Polish + Notifications + Final i18n — Context

**Gathered:** 2026-06-11 (auto mode, recommended defaults)
**Status:** Ready for planning
**Risk profile:** LOW (mostly extension + polish on top of already-shipped Phase 3/3.1/4 infrastructure)

<domain>
## Phase Boundary

Final dress rehearsal phase — close every demo-day risk. Three buckets of work, all on top of working Phase 1-4 codebase:

1. **i18n polish:** ICU pluralization for admin (I18N-03), date-fns/locale (I18N-04), declension-free template audit (I18N-05), and consolidating server-side dictionary (I18N-01 — extending the Phase 3 `apps/api/src/lib/i18n.ts` with all non-notification bot strings).
2. **Notification verification:** NOTIF-01 + NOTIF-02 are LARGELY already shipped by Phase 3 (`renderNotificationTemplate` + `notifyClient` hook on order FSM transitions). Phase 5 audits all 3 transitions fire end-to-end, removes any inline strings, ensures `/track/[token]` link is NOT present (public tracking deferred to v2).
3. **Demo-day insurance:** Snapshot tests (POLISH-01), simulate-inbound-call button (POLISH-02), pre-recorded voice fallback video (POLISH-03), `pnpm preflight` checklist script (POLISH-05), and LLM_PROVIDER Anthropic↔OpenAI failover (POLISH-06).

**In scope (10 reqs):**
- I18N-01 — server-side dictionary RU/UA for ALL bot replies + system messages
- I18N-03 — ICU MessageFormat plural rules for admin ("Найдено N машин/машины/машин")
- I18N-04 — date-fns/locale (ru, uk) for admin date display
- I18N-05 — declension-free templates ("Маршрут: {from} → {to}", not "из {from} в {to}")
- NOTIF-01 — Order FSM transition notifications via Telegram (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED — simplified, no geofence)
- NOTIF-02 — RU/UA notification templates (NO `/track/[token]` link)
- POLISH-01 — Snapshot tests on 20 canonical `extractRequest` + `calcPrice` inputs in CI
- POLISH-02 — "Simulate inbound call" button in admin (canned transcript through live LLM pipeline)
- POLISH-03 — Pre-recorded ElevenLabs call video bundled in `/dashboard/calls`
- POLISH-05 — Pre-flight checklist script (`pnpm preflight`)
- POLISH-06 — LLM_PROVIDER Anthropic↔OpenAI failover

**NOT in scope (deferred / handled by other phases):**
- `/track/[token]` public tracking page — v2 PUBLIC_V2-*
- WebSocket `/ws/tracking` live map — v2 TRACK_V2-*
- Geofence-driven LOADED/UNLOADED transitions — v2
- TTN/CMR PDF stub — v2 ADMIN_V2-TTN-PDF
- POLISH-04 (driver mobile app polish) — deferred per 2026-06-09 pivot (driver is Telegram-bot in v1)
- Real production observability (OpenTelemetry, Grafana) — v2 PROD-*
- Multi-tenant / RBAC — v2 PROD-03

</domain>

<decisions>
## Implementation Decisions

### Notification Triggers (NOTIF-01 + NOTIF-02)
- **D-01:** **REUSE Phase 3 infrastructure.** `apps/api/src/lib/i18n.ts` `renderNotificationTemplate` already ships RU + UA templates for DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED. `apps/api/src/channels/telegram/notifications.ts` `notifyClient` already invokes from FSM `onSuccess` post-commit hook (per Pitfall #3). Phase 5 does NOT rewrite this — it AUDITS and EXTENDS.
- **D-02:** **Verify all 3 transitions fire end-to-end.** Phase 3 wired DRIVER_ASSIGNED. Phase 5 confirms IN_TRANSIT + DELIVERED transitions exist in `ORDER_TRANSITIONS` AND fire `notifyClient` on commit. If a transition isn't wired, Phase 5 adds it.
- **D-03:** **NO `/track/[token]` link in any notification template** (per NOTIF-02 spec — public tracking deferred). Audit templates to confirm. CI grep guard:
  ```bash
  grep -E "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts && exit 1 || exit 0
  ```
- **D-04:** **Notifications are Telegram-only.** Skip silently when `clients.telegram_id` is NULL (already wired per Phase 3 D-26). No SMS/email/voice callback notifications.
- **D-05:** **Idempotency via `order_events` UNIQUE(order_id, type)** — Phase 1's schema constraint guarantees each transition fires exactly once. No new idempotency layer needed.

### Server-side i18n Dictionary (I18N-01)
- **D-06:** **Extend `apps/api/src/lib/i18n.ts`** (not create new file). The existing module already exports `renderNotificationTemplate`. Phase 5 adds:
  - `renderBotReply(key, params, lang)` — for all NON-notification bot replies (greeting, clarification, quote-present, confirm-ask, order-confirmed, escalation)
  - Dictionary moved from inline strings in `apps/api/src/pipeline/intake.ts` to dict.ts keys
- **D-07:** **Dictionary keys:**
  ```ts
  type BotReplyKey =
    | 'greeting'              // "Здравствуйте! Я помогу с..."
    | 'clarify-route'         // "Уточните маршрут?"
    | 'clarify-tons'          // "Сколько тонн груза?"
    | 'clarify-body-type'     // "Какой кузов нужен?"
    | 'quote-present'         // "Маршрут: {from} → {to}, {tons}т, {bodyType}. Цена: {price} {currency}."
    | 'confirm-ask'           // "Подтвердите заказ?"
    | 'order-confirmed'       // "Заказ #{number} оформлен. Ждите водителя."
    | 'escalate'              // "Передаю менеджеру."
    | 'manager-takeover'      // "Менеджер на связи."
    | 'manager-handover'      // "Менеджер передал бота. Можете продолжить."
    | 'budget-exceeded'       // "Превышен лимит обращений. Передаю менеджеру."
    ;
  ```
  All 11 keys × 2 langs = 22 templates. Numerical params (`{price}`, `{tons}`, `{number}`) MUST come from DB row, never from LLM paraphrase (Pitfall #1 reuse).
- **D-08:** **Voice channel templates stay in `elevenlabs-agent-config.md`** (per Phase 3.1 — voice prompts are Agent config, not server-side dict). Phase 5 i18n.ts is TEXT-channel only (Telegram + admin-bound).

### Declension-free Templates (I18N-05)
- **D-09:** **Audit all templates for declined city names.** Use the spec pattern: `"Маршрут: {from} → {to}"` symbol-separated, NOT `"из {from} в {to}"` which forces genitive case. Lock pattern in dict.ts comments.
- **D-10:** **Cities stored as nominative only** (already true in Phase 1 schema). No declension API. If a future template needs a declined form, hardcode the city pair instead of templating.
- **D-11:** **Template audit checklist:**
  - quote-present: uses arrow separator ✓
  - clarify-route: ask "Откуда и куда?" (no city name interpolation)
  - notification DRIVER_ASSIGNED: no city names (just truck + driver — already correct in Phase 3)
  - notification IN_TRANSIT / DELIVERED: no city names

### ICU Pluralization (I18N-03)
- **D-12:** **Library:** `@formatjs/intl-messageformat@10.x` (small, runtime-only ICU parser; no i18next bloat). Add as workspace dep at root and import in BOTH `apps/web/src/lib/i18n/dict.ts` and `apps/api/src/lib/i18n.ts`.
- **D-13:** **Plural-form coverage scope (admin only initially):**
  ```
  "Найдено {n, plural, one {# машина} few {# машины} many {# машин}}"   — fleet match result
  "{n, plural, one {# заказ} few {# заказа} many {# заказов}}"           — KPI tile labels
  "{n, plural, one {# звонок} few {# звонка} many {# звонков}}"          — KPI tile labels
  "{n, plural, one {# сообщение} few {# сообщения} many {# сообщений}}"  — KPI tile labels
  "{n, plural, one {# тонна} few {# тонны} many {# тонн}}"               — quote display
  ```
  UA equivalents: машина/машини/машин, замовлення/замовлень, дзвінок/дзвінка/дзвінків, повідомлення (uniform), тонна/тонни/тонн.
- **D-14:** **Test fixtures:** snapshot test asserting outputs for `n ∈ {0, 1, 2, 5, 21, 25}` for each plural template × 2 langs (RU + UA). 5 templates × 6 values × 2 langs = 60 assertions.
- **D-15:** **Bot replies (server-side) do NOT need ICU plural in v1** — bot replies don't render dynamic counts (quote uses `{tons}т` literal). Server-side i18n.ts adds ICU helper but doesn't use it until needed.

### date-fns/locale (I18N-04)
- **D-16:** **Add `date-fns/locale` to `apps/web/src/lib/format.ts`** (extending the Phase 4 format helper):
  ```ts
  import { ru, uk } from 'date-fns/locale';
  export function formatDateLocale(date: Date, lang: 'ru' | 'ua'): string {
    return format(date, "d MMM, EEE", { locale: lang === 'ua' ? uk : ru });
  }
  // Renders "8 июн, ср" (RU) and "8 чер, ср" (UA)
  ```
- **D-17:** **Apply to admin display only** — bot replies use `Intl.DateTimeFormat` (already in Phase 4 D-54). Admin chat thread list, calls timestamps, orders timestamps all run through `formatDateLocale`.
- **D-18:** **Pin `date-fns@4`** (already locked in STACK.md). Tree-shake — only import `ru` + `uk` locales, not full bundle (~200kb saved).

### Snapshot Tests (POLISH-01)
- **D-19:** **REUSE existing `apps/api/tests/fixtures/canonical-inputs.json`** — already has 20 canonical inputs per Phase 1. Phase 5 wires snapshot tests using this fixture.
- **D-20:** **Vitest snapshots** in `apps/api/tests/snapshots/__snapshots__/` directory. Two snapshot files:
  - `extract-request.snap.ts` — runs each canonical input through `extractRequest` tool, snapshots the validated output
  - `calc-price.snap.ts` — runs the deterministic `calcPrice` with 10 different (route, tons, body, season) combos, snapshots the kopecks output
- **D-21:** **Byte-stability requirement:** snapshot must produce IDENTICAL output across 10 consecutive CI runs. `extractRequest` is LLM-driven — use MockAnthropicClient from Phase 2 with pre-recorded responses (`apps/api/tests/fixtures/llm-responses.json` already exists). NO live LLM calls in snapshot tests.
- **D-22:** **CI gate:** `pnpm --filter @ai-logist/api test apps/api/tests/snapshots/` exits 0 + snapshot files are committed. PR diff that changes snapshots requires explicit `--update` flag review.

### "Simulate Inbound Call" Button (POLISH-02)
- **D-23:** **Backend route:** NEW `POST /api/admin/simulate-call` in `apps/api/src/routes/admin.ts` (NEW file). Accepts `{ scenarioKey: 'ru_happy_path' | 'ua_happy_path' | 'injection_attempt' | 'ambiguous_clarification' | 'abandon_mid_call' }`.
- **D-24:** **Implementation:**
  1. Read `apps/api/tests/fixtures/voice-scenarios.json` (REUSED — Phase 3.1 already shipped 5 scenarios)
  2. Create a fake `calls` row (audio_url=NULL, transcript=scenario.turns, outcome='completed', linked_lead_id=NULL initially)
  3. Replay each scenario turn through the SAME Phase 3.1 voice tool handlers (`apps/api/src/channels/voice/tool-handlers.ts`) — extractRequest → nearestTruck → calcPrice → createOrder
  4. UPDATE calls.linked_lead_id with the created lead
  5. Return `{ callId, leadId, orderId }` — admin frontend polls `/api/calls/:id` to display
- **D-25:** **Frontend:** Button "▶ Simulate inbound call" on `/dashboard/calls` page header (top-right, next to filters). Click → modal with 5 scenario buttons → POST → toast "Simulating..." → polling SWR refetch → new call appears in table within 5s. Visual identical to real voice path (uses same `CallDetailModal`).
- **D-26:** **Demo safety:** This MUST work without Twilio + ElevenLabs (no external API calls). The simulate route runs entirely on local infrastructure — DB + LLM only.
- **D-27:** **No new auth** — simulate route is admin-only (already behind `proxy.ts` auth gate at the Next.js layer; backend assumes valid request from same-VPS web app per Phase 4 D-09).

### Voice Fallback Video (POLISH-03)
- **D-28:** **MP4 file location:** `apps/web/public/demo/voice-fallback.mp4` — pre-recorded ~30-60s real call (RU happy path), real human voice or ElevenLabs export.
- **D-29:** **File size budget:** ≤15 MB (acceptable to bundle in repo for demo; production would CDN). Add `.gitattributes` to mark as binary.
- **D-30:** **UI placement:** Button "🎬 Видео-резерв" on `/dashboard/calls` page header (next to Simulate button per D-25). Click → modal with `<video controls preload="metadata" src="/demo/voice-fallback.mp4">` + RU caption track + brief description.
- **D-31:** **NO admin record created** — video is pure-demo content. Does NOT trigger any DB writes.
- **D-32:** **Captions track:** `apps/web/public/demo/voice-fallback.ru.vtt` — WebVTT format, ~20 caption cues. Optional UA captions; RU only is acceptable for v1.

### Pre-flight Checklist (POLISH-05)
- **D-33:** **Script:** `apps/api/scripts/preflight.ts` — executable via `pnpm preflight` (added to root package.json scripts).
- **D-34:** **6 checks (sequential, fail-fast):**
  ```
  1. Telegram bot alive             — bot.api.getMe() returns username
  2. Twilio number registered       — twilio.incomingPhoneNumbers.list({ phoneNumber: TWILIO_NUMBER })
  3. DB seeded                       — SELECT count(*) FROM trucks WHERE status='available' GROUP BY truck_id LIMIT 12; must be ≥10
  4. /api/health                     — HTTP 200 + checks.postgis matches /^3\.5/
  5. LLM key check                   — anthropic.messages.create({ max_tokens: 1, messages: [{role:'user',content:'ping'}] }); must succeed
  6. End-to-end smoke (RU + UA)      — Run scenario 'ru_happy_path' + 'ua_happy_path' through POST /api/admin/simulate-call; both must produce ORDER_CREATED leads
  ```
- **D-35:** **Output format:** Each check prints `✓ {name} ({duration_ms}ms)` on pass or `✗ {name}: {error}` on fail. Exits 0 if all 6 pass, 1 if any fail. Total runtime budget: ≤30s.
- **D-36:** **NO Wialon / GPS checks** (tracking deferred per pivot).
- **D-37:** **NO /track link check** (public tracking deferred per pivot).
- **D-38:** **CI integration:** Add `pnpm preflight` to README "Demo Day Checklist" section. NOT added to CI gates (requires real Telegram/Twilio credentials).

### LLM_PROVIDER Failover (POLISH-06)
- **D-39:** **Env var:** `LLM_PROVIDER` ∈ {`anthropic`, `openai`}. Default `anthropic`. Both env vars present: `ANTHROPIC_API_KEY` (existing) + `OPENAI_API_KEY` (new optional). config.ts adds Zod-validated `.optional()` field for OpenAI.
- **D-40:** **Adapter pattern:** NEW `apps/api/src/lib/llm/provider.ts`:
  ```ts
  type LLMClient = { generateText(tools, messages): Promise<{ tool_calls, text }> };
  export function getLLMClient(): LLMClient {
    return process.env.LLM_PROVIDER === 'openai' ? openaiAdapter : anthropicAdapter;
  }
  ```
- **D-41:** **OpenAI adapter:** Wraps `openai.chat.completions.create({ tools, tool_choice, messages })`. Translates OpenAI tool call format → Anthropic-shape via a small mapper. Outputs validated by the SAME Zod schemas from Phase 2.
- **D-42:** **Failover trigger: ENV-only swap with restart** (not runtime hot-swap). To swap providers during demo:
  1. `docker compose exec api sh -c "export LLM_PROVIDER=openai && kill -HUP 1"` — re-reads env on SIGHUP
  2. OR redeploy with new env var (slower, certain)
- **D-43:** **NO automatic failover** (no health-check-driven swap). Demo operator manually swaps if Anthropic API is down. Document the 30-second swap procedure in `README.md` Demo Day Checklist.
- **D-44:** **Add OpenAI SDK as optional dep:** `openai@4.x` to `apps/api/package.json` dependencies. Increases bundle ~150kb but only loaded when `LLM_PROVIDER=openai`.
- **D-45:** **Tool registry compatibility:** Both adapters consume the SAME Phase 2 tool registry (`extractRequest`, `nearestTruck`, `calcPrice`, `createOrder`, `discount`, `detectLanguage`). Adapter responsible for format translation only.
- **D-46:** **Anti-Pitfall #1 maintained:** OpenAI adapter ALSO renders prices from `leads.quoted_price` (templated, not paraphrased). Same price-guard regex. Same tool-as-security-boundary.

### Testing Strategy
- **D-47:** **Unit tests:**
  - `apps/api/tests/unit/i18n-dict.test.ts` — assert all 11 keys × 2 langs render correctly; assert no `/track/` substring
  - `apps/api/tests/unit/icu-plural.test.ts` — 60 plural assertions per D-14
  - `apps/api/tests/unit/llm-provider-adapter.test.ts` — both adapters produce same Zod-validated output for the same input (mocked)
  - `apps/web/tests/unit/format-date-locale.test.ts` — RU "8 июн, ср" + UA "8 чер, ср" assertions
- **D-48:** **Snapshot tests:** Per D-20.
- **D-49:** **Integration tests:**
  - `apps/api/tests/integration/notif-fsm-transitions.test.ts` — assert each ORDER_TRANSITION fires notifyClient (mock bot, capture sent messages)
  - `apps/api/tests/integration/simulate-call.test.ts` — POST /api/admin/simulate-call with each scenario, assert call+lead+order created end-to-end
- **D-50:** **NO new E2E** — relies on HUMAN-UAT-05.md (Phase 4) + new HUMAN-UAT-06.md (Phase 5 — pre-flight + simulate + video + provider swap).

### Configuration & Env
- **D-51:** **New env vars:**
  - `LLM_PROVIDER` (optional, default `anthropic`)
  - `OPENAI_API_KEY` (required only if `LLM_PROVIDER=openai`)
  - All else reused from Phase 1-3.1
- **D-52:** **No new infrastructure** — same docker-compose, same Caddy, same VPS sizing.

### File Layout (new files in Phase 5)
- **D-53:** **Backend additions:**
  - `apps/api/src/lib/llm/provider.ts` (new — adapter interface)
  - `apps/api/src/lib/llm/anthropic-adapter.ts` (new — wraps existing Anthropic client)
  - `apps/api/src/lib/llm/openai-adapter.ts` (new — wraps OpenAI SDK)
  - `apps/api/src/routes/admin.ts` (new — POST /api/admin/simulate-call)
  - `apps/api/src/app.ts` (modified — register adminRoutes)
  - `apps/api/src/lib/i18n.ts` (modified — add renderBotReply + ICU helper)
  - `apps/api/src/lib/icu.ts` (new — thin @formatjs/intl-messageformat wrapper)
  - `apps/api/src/pipeline/intake.ts` (modified — replace inline strings with renderBotReply calls)
  - `apps/api/scripts/preflight.ts` (new — 6-check script)
- **D-54:** **Frontend additions:**
  - `apps/web/public/demo/voice-fallback.mp4` (new binary)
  - `apps/web/public/demo/voice-fallback.ru.vtt` (new captions)
  - `apps/web/src/app/(main)/dashboard/calls/_components/simulate-call-modal.tsx` (new — scenario picker)
  - `apps/web/src/app/(main)/dashboard/calls/_components/voice-fallback-modal.tsx` (new — video player)
  - `apps/web/src/lib/format.ts` (modified — add formatDateLocale with date-fns/locale)
  - `apps/web/src/lib/i18n/dict.ts` (modified — add 5 ICU plural templates)
  - `apps/web/src/lib/i18n/icu.ts` (new — @formatjs wrapper for client)
- **D-55:** **Test additions:**
  - `apps/api/tests/snapshots/extract-request.snap.ts` + `calc-price.snap.ts`
  - `apps/api/tests/snapshots/__snapshots__/` (committed)
  - `apps/api/tests/unit/{i18n-dict,icu-plural,llm-provider-adapter}.test.ts`
  - `apps/api/tests/integration/{notif-fsm-transitions,simulate-call}.test.ts`
  - `apps/web/tests/unit/format-date-locale.test.ts`
- **D-56:** **Docs additions:**
  - `README.md` (modified — "Demo Day Checklist" section with preflight + provider swap procedure)
  - `apps/web/public/demo/README.md` (new — explains video + captions sourcing for future re-recording)
  - `.planning/phases/05-demo-polish-notifications-final-i18n/HUMAN-UAT-06.md` (new — 8-step polish UAT)

### Demo Polish Carry-Over (out of Phase 5, into v2)
- WebSocket reconnect logic — v2 TRACK_V2 / ADMIN_V2-INBOX-WS
- Locale-aware bot dates (currently Intl.DateTimeFormat — fine for v1) — v2 polish
- Multi-tenant i18n keys — v2

### Claude's Discretion
- Exact wording of new bot replies (D-07 keys) — render plausible Russian/Ukrainian during planning
- Video recording: who records it (team coordinates this physically before demo); Plan 05-XX-voice-video.md should include a checklist for the team
- Pre-flight check ordering refinements
- Whether to add `pnpm preflight --json` machine-readable output (recommend yes for future automation)
- Specific OpenAI model choice (`gpt-4o` recommended for parity with Sonnet 4 capability and tool-use quality)
- Default ICU plural messages above are starting templates — refine during execution if linguist review reveals nuance

### Folded Todos
*Нет — backlog пуст.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Project Docs
- `ai-logist-logic-spec.md` §6 — Notification template requirements (NOTIF-01 + NOTIF-02 contract)
- `ai-logist-logic-spec.md` §8 — i18n requirements (RU/UA, ICU pluralization, date format)
- `ai-logist-logic-spec.md` §9 — Demo build order (POLISH-01..06 closure criteria)
- `.planning/PROJECT.md` — Core Value (price-lock + tools-as-security-boundary apply to OpenAI adapter too)
- `.planning/REQUIREMENTS.md` — Phase 5 reqs (I18N-01/03/04/05, NOTIF-01/02, POLISH-01/02/03/05/06; POLISH-04 deferred)
- `.planning/ROADMAP.md` — Phase 5 success criteria (5 numbered items)

### Research
- `.planning/research/PITFALLS.md` Pitfall #1 — LLM in money path (applies to OpenAI adapter)
- `.planning/research/PITFALLS.md` Pitfall #11 — Prompt injection (OpenAI adapter must wrap tool boundary same as Anthropic)
- `.planning/research/PITFALLS.md` Pitfall #14 — Voice channel pressure (POLISH-02 + POLISH-03 are the answer)
- `.planning/research/PITFALLS.md` Pitfall #15 — i18n RU/UA pluralization, declension-free templates, locale-aware dates (the entire I18N-03/04/05 spec)
- `.planning/research/STACK.md` — date-fns@4 + Anthropic SDK already locked; OpenAI SDK @4.x is the next-most-mature option

### Prior Phase Contexts (must respect existing decisions)
- `.planning/phases/03-telegram-channel/03-CONTEXT.md` — D-24..D-26 (notification templates already shipped); FSM onSuccess hook pattern
- `.planning/phases/03.1-voice-channel-elevenlabs-twilio/03.1-CONTEXT.md` — voice scenarios fixture, tool handlers
- `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md` — D-25/D-26 (audio playback), D-30 (Dialog modal pattern), D-51..D-55 (i18n dict + useT pattern), D-65 (HUMAN-UAT pattern)

### Phase 1+2+3+3.1+4 Artifacts (consumed by Phase 5)
- `apps/api/src/lib/i18n.ts` — Phase 3 i18n surface to EXTEND (not replace)
- `apps/api/src/channels/telegram/notifications.ts` — notifyClient + notifyDriver (verified working)
- `apps/api/src/pipeline/intake.ts` — inline strings to migrate to dict.ts
- `apps/api/src/pipeline/llm-tools/` — Phase 2 tool registry (shared by both LLM adapters)
- `apps/api/src/channels/voice/tool-handlers.ts` — Phase 3.1 voice tool handlers (replayed by simulate-call)
- `apps/api/tests/fixtures/canonical-inputs.json` — 20 canonical extractRequest inputs (POLISH-01 source)
- `apps/api/tests/fixtures/voice-scenarios.json` — 5 voice scenarios (POLISH-02 source)
- `apps/api/tests/fixtures/llm-responses.json` — Mock Anthropic responses (POLISH-01 stability)
- `apps/api/tests/_helpers/mock-anthropic.ts` — Phase 2 mock harness (snapshot test reuse)
- `apps/web/src/lib/i18n/dict.ts` — Phase 4 admin dict (extend with ICU plural templates)
- `apps/web/src/lib/format.ts` — Phase 4 format helpers (extend with formatDateLocale)
- `apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx` — Phase 4 modal pattern (reuse for simulate + fallback video modals)
- `apps/api/src/persistence/schema/calls.ts` — Phase 3.1 calls schema (audio_url=NULL for simulated calls)

### External Library Docs
- @formatjs/intl-messageformat — https://formatjs.io/docs/intl-messageformat
- date-fns locale docs — https://date-fns.org/v4.1.0/docs/I18n
- OpenAI Node SDK — https://github.com/openai/openai-node (v4.x; tool-use API)
- Anthropic vs OpenAI tool-use mapping — both speak `function_calls` shape; the differences are field names (name vs function.name) and content type (text vs object)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1, 2, 3, 3.1, 4)
- **`apps/api/src/lib/i18n.ts`** — Phase 3's `renderNotificationTemplate(transition, row, lang)` covers 3 transitions × 2 langs. Phase 5 ADDS `renderBotReply(key, params, lang)` for bot replies.
- **`apps/api/src/channels/telegram/notifications.ts`** — `notifyClient` + `notifyDriver` already invoke from FSM `onSuccess`. Phase 5 audits the wire-up — likely zero code changes needed.
- **`apps/api/tests/fixtures/canonical-inputs.json`** — 20 canonical inputs ALREADY EXIST. Phase 5 wires them to snapshot tests; no new fixture authoring.
- **`apps/api/tests/fixtures/voice-scenarios.json`** — 5 voice scenarios ALREADY EXIST. Phase 5 simulate-call route replays them through Phase 3.1 handlers.
- **`apps/api/tests/_helpers/mock-anthropic.ts`** — Phase 2 mock harness — directly used by snapshot tests for byte-stability.
- **`apps/api/src/channels/voice/tool-handlers.ts`** — Phase 3.1 voice tool handlers — replayed by simulate-call without modification.
- **`apps/web/src/lib/i18n/dict.ts`** — Phase 4 admin dict — extend with 5 ICU plural templates.
- **`apps/web/src/lib/format.ts`** — Phase 4 formatters — extend with `formatDateLocale(date, lang)`.
- **`apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx`** — Phase 4 shadcn Dialog pattern — reused by simulate + voice-fallback modals.
- **FSM order_events UNIQUE(order_id, type)** — Phase 1 constraint guarantees notifications fire exactly once per transition (no idempotency layer needed in Phase 5).

### Established Patterns (must follow)
- **Per Pitfall #1:** OpenAI adapter MUST render prices from `leads.quoted_price` (templated, not paraphrased). Same regex guard. Same tool-as-security-boundary.
- **Per Pitfall #3:** Notifications fire ONLY after `db.transaction(...)` commits (already wired in Phase 3 onSuccess).
- **Per Pitfall #11:** Both LLM adapters wrap user input in `<client_message>` boundary + ANTI_INJECTION_PREFIX.
- **Per Pitfall #15:** Templates declension-free; ICU plurals for all dynamic counts.
- **Per Phase 3 D-26:** notifyClient skips silently when `clients.telegram_id` is NULL.
- **Per Phase 4 D-25:** Audio playback uses native `<audio>` element; voice-fallback video uses native `<video>`.

### Integration Points
- **`apps/api/src/app.ts`** — register `adminRoutes` (new) alongside existing routes.
- **`apps/api/src/routes/admin.ts`** (new) — POST /api/admin/simulate-call.
- **`apps/api/src/lib/llm/provider.ts`** (new) — adapter factory consumed by `pipeline/intake.ts` + voice tool handlers.
- **`apps/api/src/pipeline/intake.ts`** — replace inline RU/UA strings with `renderBotReply(key, params, lang)`. Replace direct `anthropic.messages.create` call with `getLLMClient().generateText(...)`.
- **`apps/api/src/channels/voice/tool-handlers.ts`** — already uses Phase 2 tools; both adapters supported transparently.
- **`apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx`** — add 2 new modal triggers in header (Simulate + Fallback Video).
- **`apps/api/scripts/preflight.ts`** (new) — standalone Node script runnable via `pnpm preflight`.

### Required New Modules
- `apps/api/src/lib/llm/{provider,anthropic-adapter,openai-adapter}.ts`
- `apps/api/src/lib/icu.ts` (server-side ICU wrapper)
- `apps/api/src/routes/admin.ts`
- `apps/api/scripts/preflight.ts`
- `apps/web/src/lib/i18n/icu.ts` (client-side ICU wrapper)
- `apps/web/src/app/(main)/dashboard/calls/_components/{simulate-call-modal,voice-fallback-modal}.tsx`
- `apps/web/public/demo/voice-fallback.mp4` + `.vtt`

### Files to Modify (not delete)
- `apps/api/src/lib/i18n.ts` — add `renderBotReply` + ICU helper
- `apps/api/src/pipeline/intake.ts` — migrate inline strings to dict keys
- `apps/api/src/app.ts` — register adminRoutes
- `apps/web/src/lib/i18n/dict.ts` — add 5 ICU plural templates
- `apps/web/src/lib/format.ts` — add formatDateLocale
- `apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx` — add 2 header buttons

### Risks / Watch-Outs
- **OpenAI tool-use format drift:** OpenAI's tool-use response shape differs from Anthropic (function.name vs name; content type wrapping). Adapter mapper MUST be tested with Zod schemas to catch drift.
- **MP4 file size:** Video must be ≤15MB to keep repo clone snappy. Use ffmpeg `-crf 28 -preset slow` to shrink — quality acceptable for 30-60s demo clip.
- **ICU plural rules for UA:** Ukrainian has 3 plural categories per CLDR (one/few/many) — same shape as Russian, but specific words differ. Linguist review recommended for the 5 templates.
- **Snapshot stability:** Mock LLM responses MUST be byte-stable; any non-determinism (e.g., timestamps in mock metadata) breaks snapshot CI gate.
- **Preflight Twilio check:** Requires real TWILIO_ACCOUNT_SID + auth — won't run in CI. Document as "local pre-demo" only.
- **Provider failover during demo:** Restart-based swap takes ~5s (Docker SIGHUP). Real-time swap mid-conversation NOT supported; in-flight conversations complete on the original provider.
- **Voice fallback video freshness:** Re-record video when ElevenLabs voice tuning changes (D-32 documents the procedure).

</code_context>

<specifics>
## Specific Ideas

- **"Demo-day insurance"** — every Phase 5 deliverable is a fallback for something that could break: Twilio down → simulate button; ElevenLabs down → fallback video; Anthropic down → OpenAI swap; un-seeded DB → preflight catches it; pluralization wrong → ICU snapshot tests catch it. Phase 5 buys peace of mind.
- **"Manager sees real UI"** — the simulate-call button must produce a call that looks visually identical to a real call in `/dashboard/calls`. Same row, same modal, same audio player (with audio_url=NULL the player shows transcript-only — acceptable for v1).
- **"Anthropic-first, OpenAI-second"** — Anthropic stays the default. OpenAI is a 30-second escape hatch, not a co-equal provider. Document the swap procedure prominently.
- **"Pre-flight runs in <30s"** — anyone can run `pnpm preflight` 5 minutes before demo to confirm green-light. Loud red ✗ output makes failures unmissable.
- **"One number per notification"** — per ROADMAP success criterion #1: each notification template contains exactly ONE number, which equals the stored field. No LLM paraphrase. Phase 3 templates already follow this (DRIVER_ASSIGNED has plate_number; IN_TRANSIT + DELIVERED have order_number only). Phase 5 audits.
- **"Locale dates only in admin"** — bot replies stay neutral (`Intl.DateTimeFormat`); admin gets the polished `"8 июн, ср"` look. Reduces blast radius.
- **"ICU for plurals only"** — don't over-engineer with full i18next migration. @formatjs/intl-messageformat is a 7KB runtime parser; load it only where plurals exist.
- **"Snapshot tests are commits"** — `.snap` files are committed to repo; any PR that modifies a snapshot needs explicit review of WHY.
- **"Video sourcing checklist for team"** — Plan 05-XX-voice-video.md will include: record real ElevenLabs call → trim to 30-60s with peak conversation moments → ffmpeg encode → save to public/demo/ → commit.
- **Demo budget impact:** Phase 5 adds OpenAI API cost ONLY if failover used during demo (~$0.02 per failover scenario). No recurring infrastructure cost. Stays within ~$15 demo budget.

</specifics>

<deferred>
## Deferred Ideas

- **POLISH-04 (driver mobile app polish)** — deferred per 2026-06-09 pivot (driver is Telegram-bot in v1)
- **Real-time provider failover** — restart-based swap is fine for v1; runtime hot-swap → v2 PROD-04
- **Multi-provider load-balancing** (cost optimization) — v2 PROD-05
- **WebSocket reconnect for /ws/inbox + /ws/tracking** — v2 (tracking deferred entirely)
- **Locale-aware bot reply dates** (date-fns in bot replies, not just admin) — out of scope; admin-only is enough for the success criteria
- **OpenTelemetry + Grafana observability** — v2 PROD-04
- **Telegram bot UA/RU language switch UI** (e.g., /lang command) — sticky lang detect from Phase 2 covers this
- **i18next migration** — over-engineering for v1; only adopt if v2 introduces 5+ locales
- **Plural rules for Belarusian / Polish / Kazakh markets** — v2 expansion
- **Video transcoding pipeline** (server-side ffmpeg) — manual record-and-bundle is fine for v1
- **Public-facing analytics for demo** — v2 ADMIN_V2-DEMO-MODE
- **Pre-flight smoke runs in CI** — needs real Telegram + Twilio credentials in CI vault; v2 PROD-05
- **POLISH-04 driver-app push notifications** — out of v1 entirely (driver = Telegram bot)

### Reviewed Todos (not folded)
*Нет — backlog пуст.*

</deferred>

---

*Phase: 05-demo-polish-notifications-final-i18n*
*Context gathered: 2026-06-11 (auto mode, 56 locked decisions)*
