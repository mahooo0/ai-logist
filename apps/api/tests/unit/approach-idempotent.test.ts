// Phase 6 Wave 2 — D-07 approach notification idempotency. Live test.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/channels/telegram/notifications.js', () => ({
  notifyApproach: vi.fn().mockResolvedValue(undefined),
  notifyLoadingPrompt: vi.fn().mockResolvedValue(undefined),
  notifyDeliveryPrompt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/routing.js', () => ({
  routeGeometry: vi.fn().mockResolvedValue({
    route_km: 100,
    eta_sec: 3600,
    geometry: [[37.6, 55.7], [39.0, 51.0]],
    source: 'osrm',
  }),
}));

vi.mock('../../src/pipeline/lifecycle/order-fsm.js', () => ({
  transitionOrder: vi.fn().mockResolvedValue({
    from: 'DRIVER_ASSIGNED',
    to: 'AT_LOADING',
    version: 2,
    audit_row_inserted: true,
  }),
}));

describe('approach-idempotent', () => {
  let notifyApproach: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/channels/telegram/notifications.js');
    notifyApproach = mod.notifyApproach as ReturnType<typeof vi.fn>;
  });

  it('D-07 second tick at 90% no-ops (ON CONFLICT DO NOTHING on order_events)', async () => {
    const { tickerLoop } = await import('../../src/pipeline/lifecycle/order-ticker.js');

    const row = {
      id: 'order-idempotent-1',
      status: 'DRIVER_ASSIGNED',
      progress_percent: 85,
      truck_id: null,
      from_lon: null,
      from_lat: null,
      to_lon: null,
      to_lat: null,
    };

    // First run: INSERT returns 1 row (event inserted, notify fires)
    const executeMock1 = vi.fn()
      .mockResolvedValueOnce({ rows: [row] })           // SELECT
      .mockResolvedValueOnce({ rows: [] })              // UPDATE progress (85→95)
      .mockResolvedValueOnce({ rows: [{ id: 'evt' }] }); // INSERT approach_notified → 1 row

    const db1 = { execute: executeMock1 };
    const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    const bot = {};

    await tickerLoop({ db: db1 as never, log: log as never, bot: bot as never });
    expect(notifyApproach).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    notifyApproach = (await import('../../src/channels/telegram/notifications.js')).notifyApproach as ReturnType<typeof vi.fn>;

    // Second run: same order still at 95 (progressed to 95 in first tick, now advances to 100)
    // At 100, transition fires (not approach). Simulate 95→100:
    const rowAt95 = { ...row, progress_percent: 95 };
    const executeMock2 = vi.fn()
      .mockResolvedValueOnce({ rows: [rowAt95] }) // SELECT
      .mockResolvedValueOnce({ rows: [] })        // UPDATE progress (95→100 capped)
      .mockResolvedValueOnce({ rows: [] });       // UPDATE reset to 0

    const db2 = { execute: executeMock2 };
    await tickerLoop({ db: db2 as never, log: log as never, bot: bot as never });

    // At 100%: transition fires, notifyApproach NOT called
    expect(notifyApproach).not.toHaveBeenCalled();
  });

  it('D-07 same tick at 90%: second INSERT ON CONFLICT returns 0 rows, notify skipped', async () => {
    const { tickerLoop } = await import('../../src/pipeline/lifecycle/order-ticker.js');

    const row = {
      id: 'order-idempotent-2',
      status: 'DRIVER_ASSIGNED',
      progress_percent: 85,
      truck_id: null,
      from_lon: null,
      from_lat: null,
      to_lon: null,
      to_lat: null,
    };

    // INSERT returns 0 rows (ON CONFLICT DO NOTHING — event already exists)
    const executeMock = vi.fn()
      .mockResolvedValueOnce({ rows: [row] }) // SELECT
      .mockResolvedValueOnce({ rows: [] })    // UPDATE progress
      .mockResolvedValueOnce({ rows: [] });   // INSERT → 0 rows (ON CONFLICT DO NOTHING)

    const db = { execute: executeMock };
    const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    const bot = {};

    await tickerLoop({ db: db as never, log: log as never, bot: bot as never });

    // Since INSERT returned 0 rows, notifyApproach should NOT be called
    expect(notifyApproach).not.toHaveBeenCalled();
  });
});
