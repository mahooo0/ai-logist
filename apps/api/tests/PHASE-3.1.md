# Phase 3.1 — Voice Channel Testing Architecture

## Stub flip schedule (phase-3.1-stubs.test.ts)

| Wave | Plan    | Flipped this wave                                                                                  | Markers remaining |
| ---- | ------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| 0    | 03.1-00 | — (12 created)                                                                                     | 12                |
| 1    | 03.1-01 | — (foundation; unit scaffolds remain pending)                                                      | 12                |
| 2    | 03.1-02 | VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, VOICE-10, VOICE-11 (9 flips) | 3                 |
| 3    | 03.1-03 | VOICE-01, VOICE-02 (2 flips)                                                                       | 1                 |
| 4    | 03.1-04 | VOICE-12 (final boundary doc reference)                                                            | 0                 |

Verifier gate after each wave:

```bash
grep -c "test.todo" apps/api/tests/unit/phase-3.1-stubs.test.ts
```

Expected sequence: `12 → 12 → 3 → 1 → 0`.

## Integration test scaffolds (Wave 0 → Wave 2/3 flips)

| File                            | Wave that flips | Production code under test                                                |
| ------------------------------- | --------------- | ------------------------------------------------------------------------- |
| voice-tool-handlers.test.ts     | 2               | apps/api/src/channels/voice/tool-handlers.ts                              |
| voice-call-lifecycle.test.ts    | 2               | apps/api/src/channels/voice/call-lifecycle.ts                             |
| voice-lang-detect.test.ts       | 2               | apps/api/src/channels/voice/call-lifecycle.ts (langDetectedHandler)       |
| voice-price-lock.test.ts        | 2               | apps/api/src/channels/voice/tool-handlers.ts (create-order)               |
| voice-injection.test.ts         | 2               | end-to-end via replayVoiceScenario                                        |
| voice-fsm-concurrency.test.ts   | 2               | advisory lock + webhook_updates ON CONFLICT                               |
| voice-system-prompt.test.ts     | 3               | apps/api/src/channels/voice/elevenlabs-agent-config.md                    |
| voice-setup.test.ts             | 3               | apps/api/scripts/voice-setup.ts                                           |

## Unit scaffolds (Wave 1 + Wave 3 flips)

| File                          | Wave that flips |
| ----------------------------- | --------------- |
| voice-signature.test.ts       | 1               |
| voice-state.test.ts           | 1               |
| health-checks-voice.test.ts   | 3               |

## Comment hygiene reminder

NO file in `apps/api/tests/` may contain the literal token-function substring
in comments or docstrings — the verifier uses naive `grep -c`. Keep that
substring strictly as a code-only occurrence inside the marker call itself.

This rule has been re-burned five times now (Phase 1 Plan 01-10, Phase 2
Plans 02-03b / 02-04a / 02-04b, Phase 3 Plan 03-00). Avoid the sixth.

## Test commands

- Unit: `pnpm --filter @ai-logist/api test:unit`
- Integration (Docker): `pnpm --filter @ai-logist/api test:integration`
- Skip integration: `AI_LOGIST_NO_DOCKER=1 pnpm --filter @ai-logist/api test`
- Live voice smoke (gated): `VOICE_TEST_REAL=1 pnpm --filter @ai-logist/api test:voice` — UAT-04

## Latency budget

Every voice tool handler MUST return in <500ms (ElevenLabs filler cliff —
Pitfall #3). voice-tool-handlers.test.ts measures via
`injectVoiceWebhook(...).elapsedMs` from `tests/_helpers/voice-driver.ts`
(sub-millisecond precision via `process.hrtime.bigint()`).

## Mock harness

All Wave 2-3 integration tests inject `MockElevenLabsClient` +
`MockTwilioClient` from `tests/_helpers/voice-mock.ts` instead of real SDKs.
This keeps CI offline-capable and protects against ElevenLabs/Twilio rate
limits during repeated test runs. Real APIs only fire in the gated
`test:voice` smoke (`VOICE_TEST_REAL=1`).

The five named scenarios in `tests/fixtures/voice-scenarios.json`
(`ru_happy_path`, `ua_happy_path`, `injection_attempt`,
`ambiguous_clarification`, `abandon_mid_call`) drive the end-to-end injection
+ ambiguity tests via `replayVoiceScenario(app, scenario)`.
