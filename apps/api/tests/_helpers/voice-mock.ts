// apps/api/tests/_helpers/voice-mock.ts
// Phase 3.1 Wave 0: SDK-agnostic mocks + HMAC signers + scenario replayer.
//
// Used by ALL Phase 3.1 integration tests so Waves 2-4 require ZERO real
// Twilio/ElevenLabs API calls. Pattern mirrors Phase 2 MockAnthropicClient
// and Phase 3 MockTelegramBot.
//
// CONTEXT 03.1-CONTEXT.md D-29 (mocks) + D-30 (5 fixture scenarios) + D-06
// (HMAC verify) + D-07 (idempotency). RESEARCH.md Block 13 verbatim.

import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

export interface MockVoiceCallback {
  endpoint: string; // e.g. '/webhook/voice/tool/extract-request'
  body: Record<string, unknown>;
  signature: string; // computed by mock helper
}

/**
 * MockElevenLabsClient — replaces ElevenLabsClient for unit tests.
 * Tests inject this via app.elevenlabs decorator in test setup.
 *
 * Mirrors the surface of @elevenlabs/elevenlabs-js used by Phase 3.1:
 *   - conversationalAi.agents.{create,update,get}
 *   - health probe via constant `health = { ok: true }`
 */
export class MockElevenLabsClient {
  // biome-ignore lint/suspicious/noExplicitAny: Vitest mock inferred types reference internal @vitest/spy package paths (TS2742); `any` keeps the test helper portable across SDK versions.
  conversationalAi: any = {
    agents: {
      create: vi.fn().mockResolvedValue({ agent_id: 'mock_agent_abc' }),
      update: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ agent_id: 'mock_agent_abc', name: 'mock' }),
    },
  };
  health = { ok: true } as const;
}

/**
 * MockTwilioClient — replaces twilio() for unit tests.
 *
 * Mirrors the methods called by voice-setup.ts + /api/health.checks.voice:
 *   - incomingPhoneNumbers(sid).{update,fetch}
 *   - api.accounts(sid).fetch
 */
export class MockTwilioClient {
  // biome-ignore lint/suspicious/noExplicitAny: Vitest mock inferred types reference internal @vitest/spy package paths (TS2742); `any` keeps the test helper portable.
  incomingPhoneNumbers: (sid: string) => any = (sid: string) => ({
    update: vi.fn().mockResolvedValue({ sid, voiceUrl: 'mock://updated' }),
    fetch: vi.fn().mockResolvedValue({ sid, phoneNumber: '+15555550100' }),
  });
  // biome-ignore lint/suspicious/noExplicitAny: Vitest mock inferred types reference internal @vitest/spy package paths (TS2742).
  api: any = {
    accounts: (sid: string) => ({
      fetch: vi.fn().mockResolvedValue({ sid, friendlyName: 'mock' }),
    }),
  };
}

/**
 * Compute a valid ElevenLabs HMAC signature for a body buffer, using the test
 * webhook secret. Mirrors `verifyElevenLabsSignature` (Wave 1 ships it in
 * apps/api/src/channels/voice/signature.ts) so tests can craft signed callbacks.
 *
 * Header name: lowercase `x-elevenlabs-signature` (Pitfall 5).
 */
export function signElevenLabsBody(rawBody: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/**
 * Compute a valid Twilio signature for a request URL + params, mirroring
 * twilio.validateRequest. Test-only — production verification uses the SDK
 * helper directly.
 *
 * Algorithm: sort param keys ascending, concat fullUrl + key + value for each,
 * HMAC-SHA1 with authToken, base64.
 */
export function signTwilioRequest(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>
): string {
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, k) => acc + k + params[k], fullUrl);
  return createHmac('sha1', authToken).update(data).digest('base64');
}

/**
 * Replay a scenario (sequence of tool callbacks) against the app under test.
 * Reads ELEVENLABS_WEBHOOK_SECRET at call time so tests can override per-case.
 *
 * Returns the array of {status, body} responses for assertion.
 */
export async function replayVoiceScenario(
  app: FastifyInstance,
  scenario: Array<{ endpoint: string; body: Record<string, unknown> }>
): Promise<Array<{ status: number; body: unknown }>> {
  const results: Array<{ status: number; body: unknown }> = [];
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('replayVoiceScenario: ELEVENLABS_WEBHOOK_SECRET must be set in test env');
  }
  for (const step of scenario) {
    const raw = Buffer.from(JSON.stringify(step.body));
    const sig = signElevenLabsBody(raw, secret);
    const res = await app.inject({
      method: 'POST',
      url: step.endpoint,
      payload: step.body,
      headers: {
        'x-elevenlabs-signature': sig,
        'content-type': 'application/json',
      },
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      parsed = res.body;
    }
    results.push({ status: res.statusCode, body: parsed });
  }
  return results;
}
