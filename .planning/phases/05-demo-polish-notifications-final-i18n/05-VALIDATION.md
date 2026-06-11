---
phase: 5
slug: demo-polish-notifications-final-i18n
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-11
completed: 2026-06-11
approved: 2026-06-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 05-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (apps/api unit + integration; apps/web unit) |
| **Config file** | `apps/api/vitest.config.ts` (existing); `apps/web/vitest.config.ts` (Phase 4 Wave 0) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit` |
| **Full suite command** | `pnpm test` (workspace fan-out: api + web) |
| **Snapshot stability run** | `pnpm --filter @ai-logist/api test:snapshot` (10× loop pattern from existing script) |
| **Estimated runtime** | ~25 s unit (api) + ~5 s unit (web) + ~10 s snapshot loop |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-logist/api test:unit` (or `pnpm --filter @ai-logist/web test` if frontend task)
- **After every plan wave:** Run full `pnpm test` workspace
- **Before `/gsd:verify-work`:** Full suite must be green + snapshot stability loop passes 10/10
- **Max feedback latency:** ~30 s (unit suite); ~60 s (full)

---

## Monotonic Marker Chain (Wave Baseline)

Phase 5 Wave 0 seeds **11 `test.todo()` markers** in `apps/api/tests/unit/phase-5-stubs.test.ts`. Each subsequent wave flips a deterministic subset to `it()` blocks. The verifier asserts monotonic decrease:

| Wave | Markers remaining | Flipped this wave | Notes |
|------|-------------------|-------------------|-------|
| W0 (test infra) | 11 | — | Baseline seed |
| W1 (NOTIF audit) | 11 | 0 | Audit only — confirms Phase 3 wiring works; no new code |
| W2 (i18n core) | 8 | 3 | I18N-01, I18N-03, I18N-05 |
| W3 (snapshot + NOTIF) | 4 | 4 | POLISH-01, NOTIF-01, NOTIF-02, I18N-04 |
| W4 (simulate + adapter + preflight) | 1 | 3 | POLISH-02, POLISH-05, POLISH-06 |
| W5 (video + UAT) | 0 | 1 | POLISH-03 |

**CI guard:** `! grep -q 'test\.todo' apps/api/tests/unit/phase-5-stubs.test.ts` must pass at Wave 5 completion.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-00-01 | 00 | 0 | infra | unit | `pnpm --filter @ai-logist/api test apps/api/tests/unit/phase-5-stubs.test.ts` | ❌ W0 | ⬜ pending |
| 05-00-02 | 00 | 0 | infra | unit/web | `pnpm --filter @ai-logist/web test` | ❌ W0 | ⬜ pending |
| 05-01-01 | 01 | 1 | NOTIF-01 audit | integration | `pnpm --filter @ai-logist/api test apps/api/tests/integration/notif-fsm-transitions.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | NOTIF-02 audit | unit | `pnpm --filter @ai-logist/api test apps/api/tests/unit/i18n-no-track-link.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | I18N-01 | unit | `pnpm --filter @ai-logist/api test apps/api/tests/unit/i18n-dict.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | I18N-03 + I18N-05 | unit | `pnpm --filter @ai-logist/api test apps/api/tests/unit/icu-plural.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | POLISH-01 | snapshot | `pnpm --filter @ai-logist/api test:snapshot` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 3 | I18N-04 | unit | `pnpm --filter @ai-logist/web test format-date-locale` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | POLISH-02 | integration | `pnpm --filter @ai-logist/api test apps/api/tests/integration/simulate-call.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 4 | POLISH-06 | unit | `pnpm --filter @ai-logist/api test apps/api/tests/unit/llm-provider-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-03 | 04 | 4 | POLISH-05 | script | `pnpm preflight --dry-run` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 5 | POLISH-03 | smoke | manual + `head -c 4 apps/web/public/demo/voice-fallback.mp4 \| xxd` | ❌ W0 | ⬜ pending |
| 05-05-02 | 05 | 5 | UAT | manual | HUMAN-UAT-06.md | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (test infrastructure)

- [ ] `apps/api/tests/unit/phase-5-stubs.test.ts` — 11 `test.todo()` markers (1 per Phase 5 requirement)
- [ ] `apps/api/tests/integration/notif-fsm-transitions.test.ts` — scaffold gated `describe.skipIf(!dockerAvailable)`
- [ ] `apps/api/tests/integration/simulate-call.test.ts` — scaffold gated `describe.skipIf(!dockerAvailable)`
- [ ] `apps/api/tests/unit/i18n-dict.test.ts` — scaffold (W2 flips)
- [ ] `apps/api/tests/unit/i18n-no-track-link.test.ts` — scaffold (W1 flips)
- [ ] `apps/api/tests/unit/icu-plural.test.ts` — scaffold (W2 flips)
- [ ] `apps/api/tests/unit/llm-provider-adapter.test.ts` — scaffold (W4 flips)
- [ ] `apps/api/tests/snapshots/extract-request.snap.ts` — scaffold for POLISH-01
- [ ] `apps/api/tests/snapshots/calc-price.snap.ts` — scaffold for POLISH-01
- [ ] `apps/api/tests/snapshots/__snapshots__/.gitkeep` — directory committed
- [ ] `apps/web/tests/unit/format-date-locale.test.ts` — scaffold (W3 flips)
- [ ] `apps/api/tests/PHASE-5.md` — wave-by-wave flip schedule doc

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram notification delivery | NOTIF-01 | Requires real BotFather token + live chat | HUMAN-UAT-06 step 3: trigger DRIVER_ASSIGNED → IN_TRANSIT → DELIVERED via psql UPDATE; confirm message arrives in Telegram chat |
| Twilio number answers preflight | POLISH-05 | Requires real Twilio credentials | `pnpm preflight` — check 2 must pass on demo machine |
| Voice fallback video plays | POLISH-03 | Requires browser playback verification | HUMAN-UAT-06 step 5: navigate to /dashboard/calls → click "Видео-резерв" → verify 30-60s playback with RU captions |
| OpenAI failover works under load | POLISH-06 | Requires real OpenAI key + provider swap procedure | HUMAN-UAT-06 step 7: set LLM_PROVIDER=openai → restart api → run simulate-call ru_happy_path → confirm order created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (13 mapped above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (all waves have ≥1 automated check)
- [ ] Wave 0 covers all MISSING references (12 scaffolds listed above)
- [ ] No watch-mode flags (all commands `vitest run` or `pnpm preflight --dry-run`)
- [ ] Feedback latency < 30s (unit suite per wave)
- [ ] `nyquist_compliant: true` set in frontmatter at Wave 5 close
- [ ] `wave_0_complete: true` set in frontmatter at Wave 0 close

**Approval:** pending (flipped to approved at Plan 05-05-uat-gate close)
