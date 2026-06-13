// apps/api/tests/unit/voice-outbound-dialer.test.ts
//
// Voice-confirmation demo flow — asserts dialOrderConfirmation builds the
// right ElevenLabs `/v1/convai/twilio/outbound-call` payload and pre-seeds
// Redis with order context for the confirmLoading / confirmDelivery tools.
//
// Pure unit test — no Docker / no testcontainers. Mocks: global.fetch +
// in-memory Redis + a Db with a one-shot `execute` returning a hard-coded row.
// The `config` module is vi.mock'd because Zod parses env on first import and
// the resulting `config` object is frozen — we can't flip ENV vars per-test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the production config module BEFORE importing the dialer so the
// in-test mutations below propagate. `vi.hoisted` runs before vi.mock factory.
const mockConfig = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'sk_test_ELEVEN' as string | undefined,
  ELEVENLABS_AGENT_ID: 'agent_intake_legacy' as string | undefined,
  ELEVENLABS_AGENT_ID_CONFIRM: 'agent_confirm_xxx' as string | undefined,
  ELEVENLABS_PHONE_NUMBER_ID: 'phnum_xxx' as string | undefined,
  DEMO_CLIENT_PHONE: undefined as string | undefined,
}));

vi.mock('../../src/config.js', () => ({ config: mockConfig }));

const { dialOrderConfirmation } = await import('../../src/channels/voice/outbound.js');
const { getVoiceState } = await import('../../src/channels/voice/state.js');

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

function createMockDb(row: Record<string, unknown> | null) {
  return {
    execute: vi.fn(async () => ({ rows: row ? [row] : [] })),
  };
}

const SAMPLE_ROW = {
  order_id: 'order-uuid-1',
  order_number: '#KU-4471',
  client_id: 'cli-uuid-1',
  lead_id: 'lead-uuid-1',
  client_phone: '+15551112222',
  client_lang: 'ru',
  plate: 'АА0001АА',
  driver_name: 'Иван Петров',
  pickup_address: 'Киев',
  delivery_address: 'Львов',
  tons: '18',
  body_type: 'tent',
};

const NOOP_LOG = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<typeof dialOrderConfirmation>[0]['log'];

describe('dialOrderConfirmation', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Reset config to demo-ready baseline for each test.
    mockConfig.ELEVENLABS_API_KEY = 'sk_test_ELEVEN';
    mockConfig.ELEVENLABS_AGENT_ID = 'agent_intake_legacy';
    mockConfig.ELEVENLABS_AGENT_ID_CONFIRM = 'agent_confirm_xxx';
    mockConfig.ELEVENLABS_PHONE_NUMBER_ID = 'phnum_xxx';
    mockConfig.DEMO_CLIENT_PHONE = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs to ElevenLabs with loading_confirmation dynamic_variables', async () => {
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ conversation_id: 'conv_outbound_1' }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/twilio/outbound-call');
    const body = JSON.parse(init.body as string);
    expect(body.agent_id).toBe('agent_confirm_xxx');
    expect(body.agent_phone_number_id).toBe('phnum_xxx');
    expect(body.to_number).toBe('+15551112222');
    expect(body.conversation_initiation_client_data.dynamic_variables).toEqual({
      flow: 'loading_confirmation',
      order_id: 'order-uuid-1',
      order_number: '#KU-4471',
      plate: 'АА0001АА',
      driver_name: 'Иван Петров',
      address: 'Киев', // pickup for loading flow
      cargo_summary: '18 т, tent',
      client_lang: 'ru',
    });
    // Per-call first_message override — without this, ElevenLabs falls back to
    // the agent's default (inbound greeting) which is wrong for outbound.
    expect(
      body.conversation_initiation_client_data.conversation_config_override?.agent?.first_message
    ).toMatch(/Машина АА0001АА.*подъехала.*Готовы к погрузке/);
  });

  it('falls back to ELEVENLABS_AGENT_ID when ELEVENLABS_AGENT_ID_CONFIRM is unset', async () => {
    mockConfig.ELEVENLABS_AGENT_ID_CONFIRM = undefined;
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ conversation_id: 'conv_outbound_4' }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.agent_id).toBe('agent_intake_legacy');
  });

  it('uses delivery_address + flow=delivery_confirmation when stage=delivery', async () => {
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ conversation_id: 'conv_outbound_2' }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'delivery',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.conversation_initiation_client_data.dynamic_variables.flow).toBe(
      'delivery_confirmation'
    );
    expect(body.conversation_initiation_client_data.dynamic_variables.address).toBe('Львов');
  });

  it('DEMO_CLIENT_PHONE wins over clients.phone', async () => {
    mockConfig.DEMO_CLIENT_PHONE = '+9940552660728';
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ conversation_id: 'conv_outbound_3' }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.to_number).toBe('+9940552660728');
  });

  it('skips dialing (no fetch) when clients.phone is a placeholder and no DEMO override', async () => {
    const redis = createMockRedis();
    const db = createMockDb({ ...SAMPLE_ROW, client_phone: 'tg:12345' });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('seeds Redis voice state with order_id + flow on 2xx response', async () => {
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ conversation_id: 'conv_seed_1' }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    const seeded = await getVoiceState(redis as never, 'conv_seed_1');
    expect(seeded).not.toBeNull();
    expect(seeded?.order_id).toBe('order-uuid-1');
    expect(seeded?.flow).toBe('loading_confirmation');
    expect(seeded?.client_id).toBe('cli-uuid-1');
    expect(seeded?.lead_id).toBe('lead-uuid-1');
  });

  it('does not seed Redis when ElevenLabs returns non-2xx', async () => {
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('swallows fetch exceptions (never throws into the FSM caller)', async () => {
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof globalThis.fetch;

    await expect(
      dialOrderConfirmation({
        db: db as never,
        redis: redis as never,
        log: NOOP_LOG,
        orderId: 'order-uuid-1',
        stage: 'loading',
      })
    ).resolves.toBeUndefined();
  });

  it('returns early when order row is missing (no fetch, no seed)', async () => {
    const redis = createMockRedis();
    const db = createMockDb(null);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'unknown-order',
      stage: 'loading',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('returns early when ELEVENLABS_PHONE_NUMBER_ID is unset', async () => {
    mockConfig.ELEVENLABS_PHONE_NUMBER_ID = undefined;
    const redis = createMockRedis();
    const db = createMockDb(SAMPLE_ROW);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await dialOrderConfirmation({
      db: db as never,
      redis: redis as never,
      log: NOOP_LOG,
      orderId: 'order-uuid-1',
      stage: 'loading',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
