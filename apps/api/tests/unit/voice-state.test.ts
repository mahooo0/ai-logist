// apps/api/tests/unit/voice-state.test.ts
// Phase 3.1 Wave 1 — asserts Redis voice state CRUD with bigint replacer/reviver
// round-trip + TTL 3600s + mergeVoiceState partial-update semantics (D-18/D-19).
//
// Uses an in-memory Redis mock with the minimum surface ioredis exposes for
// set/get/del — production calls go through the same shapes (EX seconds, key
// strings, no pipelines).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteVoiceState,
  getVoiceState,
  mergeVoiceState,
  setVoiceState,
  type VoiceState,
} from '../../src/channels/voice/state.js';

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (k: string, v: string, _ex: string, _ttl: number) => {
      store.set(k, v);
    }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
}

const SAMPLE: VoiceState = {
  conversation_id: 'conv_ru_001',
  client_id: 'cli_abc',
  lead_id: 'lead_xyz',
  lang: 'ru',
  quoted_price: 2_450_000n,
  created_at: '2026-06-10T12:00:00.000Z',
};

describe('Phase 3.1 — voice state CRUD', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('setVoiceState writes key voice:state:<conv> with EX 3600', async () => {
    await setVoiceState(redis as never, SAMPLE);
    expect(redis.set).toHaveBeenCalledWith(
      'voice:state:conv_ru_001',
      expect.any(String),
      'EX',
      3600
    );
  });

  it('getVoiceState round-trips bigint quoted_price without precision loss', async () => {
    await setVoiceState(redis as never, SAMPLE);
    const loaded = await getVoiceState(redis as never, 'conv_ru_001');
    expect(loaded).not.toBeNull();
    expect(loaded?.quoted_price).toBe(2_450_000n);
    expect(typeof loaded?.quoted_price).toBe('bigint');
  });

  it('getVoiceState returns null when key absent', async () => {
    const loaded = await getVoiceState(redis as never, 'conv_missing');
    expect(loaded).toBeNull();
  });

  it('mergeVoiceState updates partial fields and preserves the rest', async () => {
    await setVoiceState(redis as never, SAMPLE);
    const merged = await mergeVoiceState(redis as never, 'conv_ru_001', { lang: 'ua' });
    expect(merged?.lang).toBe('ua');
    expect(merged?.client_id).toBe('cli_abc');
    expect(merged?.quoted_price).toBe(2_450_000n);
  });

  it('mergeVoiceState returns null when conversation has no existing state', async () => {
    const merged = await mergeVoiceState(redis as never, 'conv_missing', { lang: 'ua' });
    expect(merged).toBeNull();
  });

  it('deleteVoiceState removes the key', async () => {
    await setVoiceState(redis as never, SAMPLE);
    await deleteVoiceState(redis as never, 'conv_ru_001');
    const loaded = await getVoiceState(redis as never, 'conv_ru_001');
    expect(loaded).toBeNull();
  });
});
