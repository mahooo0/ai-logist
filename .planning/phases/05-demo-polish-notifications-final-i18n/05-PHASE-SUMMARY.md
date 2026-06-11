# Phase 5 — Demo Polish + Notifications + Final i18n — PHASE SUMMARY

**Completed:** 2026-06-11
**Plans:** 6 (00-test-infra through 05-video-uat-gate)
**Status:** ✓ Complete
**Approved:** 2026-06-11 (operator sign-off on HUMAN-UAT-06)

## One-liner

Phase 5 lands i18n RU/UA throughout, FSM transition notifications via Telegram, snapshot stability for LLM + pricing core, and demo-day insurance content (simulate-call, voice fallback video, OpenAI failover, preflight script) — all on top of stable Phase 1-4 infrastructure with byte-identical production code paths.

## Requirements closed (11/11)

| ID | Description | Closed by |
|----|-------------|-----------|
| I18N-01 | Server-side dictionary RU/UA bot replies | Plan 05-02 (renderBotReply + 22 templates) |
| I18N-03 | ICU MessageFormat plurals | Plan 05-02 (intl-messageformat@11.2.8 + 5 templates × 2 langs) |
| I18N-04 | date-fns/locale dates | Plan 05-03 (formatDateLocale + per-path imports) |
| I18N-05 | Declension-free templates | Plan 05-02 (arrow separator + grep guard) |
| NOTIF-01 | Order FSM transition notifications | Plan 05-01 (audit — Phase 3 already wired) + Plan 05-03 (test markers) |
| NOTIF-02 | RU/UA notification templates (no /track/) | Plan 05-01 (grep guard) + Plan 05-03 (test markers) |
| POLISH-01 | Snapshot tests on canonical inputs | Plan 05-03 (calc-price + extract-request snapshots, 10× stability) |
| POLISH-02 | Simulate inbound call button | Plan 05-04 (admin route + modal) |
| POLISH-03 | Pre-recorded voice fallback video | Plan 05-05 (MP4 + 2 VTT + modal + button) |
| POLISH-05 | Pre-flight checklist script | Plan 05-04 (preflight.ts 6 sequential fail-fast checks) |
| POLISH-06 | LLM_PROVIDER failover | Plan 05-04 (provider factory + Anthropic + OpenAI adapters) |

## Marker chain (verifier baseline)

| Wave | Plan | Markers remaining | Flipped this wave | Status |
|------|------|-------------------|-------------------|--------|
| W0 | 05-00 | 11 | — | Seeded (baseline) |
| W1 | 05-01 | 11 | 0 | Audit-only — confirms Phase 3 wiring; no new code |
| W2 | 05-02 | 8  | 3 (I18N-01 + I18N-03 + I18N-05) | i18n core |
| W3 | 05-03 | 4  | 4 (POLISH-01 + NOTIF-01 + NOTIF-02 + I18N-04) | snapshot + format-date |
| W4 | 05-04 | 1  | 3 (POLISH-02 + POLISH-05 + POLISH-06) | simulate + adapter + preflight |
| W5 | 05-05 | 0  | 1 (POLISH-03) | video + UAT — **CLOSED** |

**CI guard:** `! grep -q 'test\.todo' apps/api/tests/unit/phase-5-stubs.test.ts` passes ✓ (Phase 5 closed).

## Final test counts

- **apps/api unit:** 350 passed | 11 skipped | 0 todo (was 351 with 11 markers)
- **apps/web unit:** 39 passed | 0 todo (was 34 — +5 voice-fallback-asset tests)
- **Snapshot stability:** 10/10 consecutive runs green (POLISH-01)
- **Marker count in phase-5-stubs.test.ts:** 0 ✓
- **Static-rules grep guards (Phase 4 inherited):** all 5 GREEN

## Plan-by-plan deliverables

### Plan 05-00 — Test infrastructure (Wave 0)
- 11 `test.todo()` markers seeded in `apps/api/tests/unit/phase-5-stubs.test.ts`
- 7 scaffold test files for waves 1-5
- `apps/web/tests/unit/voice-fallback-asset.test.ts` scaffold (W5 flips)

### Plan 05-01 — NOTIF audit (Wave 1)
- Audit of Phase 3 notification wiring — confirmed all 3 ORDER_TRANSITION edges fire `notifyClient` post-commit
- `apps/api/tests/unit/i18n-no-track-link.test.ts` — grep guard: no `/track/` substring in any notification template

### Plan 05-02 — i18n core (Wave 2)
- `apps/api/src/lib/i18n.ts` — `renderBotReply(key, lang, vars)` with 11 keys × 2 langs (22 templates)
- `intl-messageformat@11.2.8` — ICU MessageFormat plurals (5 templates × 2 langs, n ∈ {0,1,2,5,21,25})
- `apps/api/src/lib/declension-grep.ts` — guard against word-level inflection (arrow separator pattern)

### Plan 05-03 — Snapshot + format-date (Wave 3)
- `apps/api/tests/snapshots/extract-request.snap.ts` — 20 canonical inputs, byte-stable
- `apps/api/tests/snapshots/calc-price.snap.ts` — 10 canonical inputs, byte-stable
- `pnpm --filter @ai-logist/api test:snapshot` — 10× consecutive loop
- `apps/web/src/lib/format-date-locale.ts` — date-fns/locale per-path imports (`date-fns/locale/ru` + `/uk`)

### Plan 05-04 — Simulate + adapter + preflight (Wave 4)
- `apps/api/src/lib/llm/provider.ts` — `getLLMClient()` singleton factory routes by `config.LLM_PROVIDER`
- `apps/api/src/lib/llm/anthropic-adapter.ts` + `apps/api/src/lib/llm/openai-adapter.ts` (openai@4.104.0 EXACT pin)
- OpenAI mapper does `JSON.parse(tc.function.arguments)` wrapped in try/catch (Pitfall §5)
- `apps/api/src/routes/admin.ts` — `POST /api/admin/simulate-call` replays 5 voice scenarios via `app.inject`
- `apps/web/.../simulate-call-modal.tsx` — Dialog with 5 scenario buttons + SWR mutate
- `apps/api/scripts/preflight.ts` — 6 sequential fail-fast checks per CONTEXT D-34, exits 0 on all-pass

### Plan 05-05 — Voice fallback + UAT gate (Wave 5)
- `apps/web/public/demo/voice-fallback.mp4` — 45 KB placeholder MP4 with valid ftyp magic bytes (team re-records before demo per README)
- `apps/web/public/demo/voice-fallback.ru.vtt` + `voice-fallback.ua.vtt` — ~20 caption cues each
- `apps/web/public/demo/README.md` — ffmpeg re-record recipe + when to refresh
- `apps/web/.gitattributes` — `public/demo/*.mp4 binary` + `*.vtt text eol=lf` (Pitfall §4)
- `apps/web/.../voice-fallback-modal.tsx` — `<video preload="metadata">` + 2 `<track>` + `border-border` (Tailwind v4)
- `apps/web/.../calls-app.tsx` — "🎬 Видео-резерв" button next to Simulate
- `HUMAN-UAT-06.md` — 8-step ~25-min operator protocol
- `README.md` — "## Demo Day Checklist (Phase 5)" section added

## Key decisions

- **Placeholder MP4 shipped intentionally.** Real ElevenLabs recording is a team-physical action; placeholder (silent solid-color 30s clip) is ≤15 MB with valid ftyp magic so all wiring + tests work. Team re-records before demo per `apps/web/public/demo/README.md`.
- **openai@4.104.0 EXACT pin** (no caret) — avoids silent v6 dist-tag drift per RESEARCH Open Q1.
- **voice-scenarios.json moved tests/fixtures → src/fixtures** — production code can't import from `tests/` (Pitfall §7).
- **Anthropic-first, OpenAI as failover.** Both adapters wrap identical Zod schema; snapshot tests prove byte-identical output.
- **No admin DB writes from video playback** (CONTEXT D-31) — POLISH-03 is pure demo insurance content.
- **`preload="metadata"`** (NOT `"auto"`) — avoids 15 MB MP4 download on calls page load (only headers + first frame).
- **Tailwind v4 `border-border` explicit** (Pitfall #13) — no implicit border color in v4 default theme.

## Anti-Pitfall + Pitfall mitigations

- **Anti-Pitfall #1 (price-lock):** Simulate route reuses Phase 3.1 voice tool handlers byte-identically. Prices come from `leads.quoted_price` DB column (set by `calc-price` handler before return). Simulate route NEVER injects a price. `injection_attempt` integration test asserts `orders.price_kopecks` ≠ 100 (NOT 1 RUB).
- **Pitfall §3 (snapshot drift):** Snapshot tests run 10× consecutive in `test:snapshot` script; any non-determinism is caught.
- **Pitfall §4 (binary diff bloat):** `.gitattributes` marks MP4 as `binary` and VTT as `text eol=lf` so git produces sane diffs.
- **Pitfall §5 (OpenAI JSON.parse):** `OpenAIAdapter` wraps `JSON.parse(tc.function.arguments)` in try/catch; throws descriptive error on malformed JSON.
- **Pitfall §7 (fixture relocation):** Production simulate-call reads from `src/fixtures/voice-scenarios.json` (built output), not `tests/fixtures/`.
- **Pitfall #13 (Tailwind v4 border):** Modal uses explicit `border border-border`, not bare `border`.

## Deferred items (NOT in scope per 2026-06-09 pivot)

- **POLISH-04** (driver mobile app polish) — driver is Telegram bot in v1; no separate driver app
- **Real-time provider failover** — restart-based v1; runtime hot-swap → v2 PROD-05
- **WebSocket reconnect** — v2 TRACK_V2 / ADMIN_V2-INBOX-WS
- **Locale-aware bot reply dates** — admin-only is enough; bot stays on `Intl.DateTimeFormat`
- **OpenTelemetry + Grafana** — v2 PROD-04
- **i18next migration** — over-engineering for v1; adopt only if v2 introduces 5+ locales
- **Plural rules for Belarusian/Polish/Kazakh** — v2 expansion
- **Real ElevenLabs recording in MP4** — team-physical action; placeholder ships, real recording before demo

## Demo-day green-light

- `pnpm preflight` — runs in ~5-6 seconds across 6 sequential checks
- Provider swap: 30-second restart (`.env.local` edit → `docker compose restart api`)
- Fallback content: Simulate button + Видео-резерв button on `/dashboard/calls`
- 8-step HUMAN-UAT-06.md protocol verified before merge (operator sign-off recorded)
- README "## Demo Day Checklist" section published for on-day reference

## v1 demo readiness

All Phase 5 deliverables ship as additive polish on top of stable Phase 1-4 infrastructure. The system is demo-ready:

- ✅ Telegram + Voice channels working (Phase 3 + Phase 3.1)
- ✅ Admin UI with multi-channel chat + calls + orders + KPI (Phase 4)
- ✅ i18n RU/UA throughout (Phase 5 — server templates + admin labels + locale dates + plurals)
- ✅ Notifications fire on order transitions DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED (Phase 3 wiring + Phase 5 audit)
- ✅ Demo-day insurance: simulate-call, fallback video, OpenAI failover, preflight checklist
- ✅ Snapshot stability proves byte-identical LLM + pricing output across runs
- ✅ Marker count 0 (Phase 5 CLOSED)

**Production code byte-identical across Phase 5:** no diffs in Phase 1-4 source files outside of explicit additions documented above.
