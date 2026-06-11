# Phase 5: Demo Polish + Notifications + Final i18n — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 05-CONTEXT.md.

**Date:** 2026-06-11
**Phase:** 05-demo-polish-notifications-final-i18n
**Mode:** auto (recommended defaults — no interactive Q&A)
**Areas auto-selected:** All 9 gray areas

---

## Auto-mode rationale

Per workflow auto-mode rules, Claude selected the recommended option for each gray area without using AskUserQuestion. Phase 5 is a low-risk polish phase building on top of fully-shipped Phase 1-4 infrastructure; deviating from defaults was not warranted.

## Gray Areas Auto-Resolved

### 1. Notification trigger boundary (NOTIF-01 + NOTIF-02)
**Options considered:** Rewire from scratch | Extend Phase 3 infrastructure | Hybrid (rewrite + extend)
**Selected:** Extend Phase 3 infrastructure (recommended)
**Rationale:** Phase 3 D-24..D-26 already shipped `renderNotificationTemplate` + `notifyClient` + FSM onSuccess hook. Re-doing this would burn time and risk regressions. Phase 5 audits, doesn't rewrite.

### 2. i18n library choice for ICU pluralization (I18N-03)
**Options considered:** i18next + i18next-icu | @formatjs/intl-messageformat (recommended) | Hand-rolled with Intl.PluralRules
**Selected:** @formatjs/intl-messageformat (recommended)
**Rationale:** PITFALLS.md #15 recommends ICU MessageFormat. @formatjs is the lightest runtime ICU parser (~7KB), no provider wrapper overhead, integrates with existing dict.ts. i18next would be a 200KB migration for zero new capability.

### 3. Plural form coverage scope
**Options considered:** Admin only (recommended) | Admin + bot | Bot only
**Selected:** Admin only (D-13/D-15)
**Rationale:** Bot replies don't render dynamic counts in v1. Admin has 5 specific count strings. Scoping to admin keeps blast radius minimal.

### 4. date-fns/locale wiring (I18N-04)
**Options considered:** Admin only (recommended) | Admin + bot | Bot only
**Selected:** Admin only (D-16/D-17)
**Rationale:** Success criteria #2 specifies admin date display. Bot uses Intl.DateTimeFormat already (Phase 4 D-54) — switching it adds risk for no demo win.

### 5. "Simulate inbound call" plumbing (POLISH-02)
**Options considered:** Replay through Phase 3.1 voice handlers (recommended) | Replay through Phase 2 intake | Run live LLM with full conversation
**Selected:** Replay through Phase 3.1 voice handlers (D-23/D-24)
**Rationale:** Phase 3.1 tool handlers already replay voice scenarios via `replayVoiceScenario` helper (Phase 3.1 Plan 00 voice-driver.ts). REUSE the existing pattern; produces calls row + lead + order identical to real path.

### 6. Voice fallback video format/placement (POLISH-03)
**Options considered:** MP4 in repo (recommended) | CDN-hosted MP4 | Embedded YouTube link
**Selected:** MP4 in repo at apps/web/public/demo/ (D-28..D-32)
**Rationale:** Self-contained demo (no external dependencies during venue WiFi outage). 15MB budget is acceptable for repo. YouTube risks 403/region-block; CDN adds infrastructure.

### 7. Pre-flight checklist scope (POLISH-05)
**Options considered:** 6 checks fail-fast (recommended) | 12 exhaustive checks | Minimal 3 (bot + DB + health)
**Selected:** 6 checks fail-fast (D-34)
**Rationale:** Maps 1:1 to ROADMAP success criteria #5. Fail-fast = ≤30s runtime. Minimal misses simulate-call + LLM key. Exhaustive over-engineers for demo scope.

### 8. LLM_PROVIDER failover mechanism (POLISH-06)
**Options considered:** ENV swap + restart (recommended) | Runtime hot-swap | Auto failover on health check
**Selected:** ENV swap + restart, manual operator trigger (D-39..D-43)
**Rationale:** Restart takes ~5s with Docker SIGHUP. Runtime hot-swap requires connection pool reset (Phase 1-3 architecture doesn't support gracefully). Auto-failover is over-engineering — demo operator can spot Anthropic outage and trigger swap manually in 30s.

### 9. Snapshot test storage + stability (POLISH-01)
**Options considered:** Vitest __snapshots__ with MockAnthropic (recommended) | JSON fixtures committed | Live LLM snapshots
**Selected:** Vitest __snapshots__ + MockAnthropic (D-20/D-21)
**Rationale:** Phase 2 already ships mock-anthropic.ts harness. Live LLM would be non-deterministic (no byte-stability across 10 runs). JSON fixtures are less standard than Vitest snapshots.

---

## Claude's Discretion (deferred to planning/execution)

- Exact wording of new bot replies (D-07 keys)
- Video recording physical workflow (team coordinates)
- Pre-flight check ordering refinements (e.g., parallel vs sequential)
- `pnpm preflight --json` machine-readable output (recommended addition)
- Specific OpenAI model (`gpt-4o` recommended)
- ICU plural template wording refinements (linguist review optional)

## Deferred Ideas (noted, not implemented)

- WebSocket reconnect (tracking deferred entirely)
- Locale-aware bot dates
- i18next migration
- POLISH-04 (driver-app polish — driver is Telegram-bot in v1)
- Auto-failover health checks
- Multi-provider load balancing

## External Research

None performed (Phase 5 is well-understood polish work; PITFALLS.md #15 already covers ICU + date-fns nuances).
