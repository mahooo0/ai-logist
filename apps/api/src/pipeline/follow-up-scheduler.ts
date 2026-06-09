// Phase 2 Plan 02-04b Task 3 — auto-follow-up scheduler (FSM-06).
//
// CONTEXT D-31 + 02-RESEARCH.md §14 (verbatim). Closes Pitfall #12 second-half:
// long-quiet leads are deterministically retired rather than accumulating cost
// in lead_events / messages forever.
//
// Lifecycle:
//   - `registerFollowUpScheduler(app)` wires `setInterval(tick, POLL_INTERVAL_MS)`
//     to Fastify's plugin lifecycle. The interval handle is cleared via
//     `app.addHook('onClose', () => clearInterval(handle))` so SIGTERM / vitest
//     shutdown does not leak a long-lived timer.
//   - Skips entirely when `app.config.NODE_ENV === 'test'` — tests drive
//     `followUpTick` either directly (fast unit-style assertion) or via
//     `vi.useFakeTimers()` + `setSystemTime` + `advanceTimersByTime` to exercise
//     the full setInterval lifecycle deterministically.
//
// Tick logic:
//   - Stale (lead in QUOTED|AGREED, updated_at < NOW() - 24h) → transitionLead
//     → LOST with payload.reason='no_reply_24h'.
//   - Quiet (updated_at in [24h, 4h) ago) → log only. Phase 4 admin notification
//     is a no-op stub here; the manager UI will subscribe via webhook in a
//     later phase.

import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { config as importedConfig } from '../config.js';
import type { Db } from '../db.js';
import { transitionLead } from './lifecycle/lead-fsm.js';

export const POLL_INTERVAL_MS = 60_000;
export const QUIET_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Minimal app shape for testability — the production Fastify instance satisfies
 * the same fields via `dbPlugin` decorator + `config` import.
 */
export interface SchedulerApp {
  db: Db;
  log: FastifyBaseLogger;
  config?: { NODE_ENV?: string };
}

/**
 * One scheduler iteration. Pure: opens its own queries via `app.db`, does not
 * mutate scheduler-level state. Exposed separately so tests can drive it
 * directly without spinning the full setInterval lifecycle.
 */
export async function followUpTick(app: SchedulerApp): Promise<void> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_MS);
  const quietCutoff = new Date(now.getTime() - QUIET_THRESHOLD_MS);

  // Stale: lead in QUOTED|AGREED whose updated_at is older than 24h → → LOST.
  const stale = await app.db.execute(sql`
    SELECT id FROM leads
    WHERE stage IN ('QUOTED', 'AGREED')
      AND updated_at < ${staleCutoff.toISOString()}::timestamptz
  `);
  for (const row of stale.rows as Array<{ id: string }>) {
    try {
      await transitionLead(app.db, {
        leadId: row.id,
        to: 'LOST',
        actor: 'system',
        payload: { reason: 'no_reply_24h' },
      });
      app.log.info({ leadId: row.id }, 'follow-up: → LOST (no_reply_24h)');
    } catch (e) {
      // Concurrent writer (e.g. user confirms in the same tick) — leave the
      // current state intact and let the next tick re-scan.
      app.log.warn({ leadId: row.id, err: e }, 'follow-up: transition failed (likely concurrent)');
    }
  }

  // Quiet: updated_at in the [24h, 4h) window → emit a debug log. Phase 4 will
  // attach a manager-notification hook here.
  const quiet = await app.db.execute(sql`
    SELECT id FROM leads
    WHERE stage IN ('QUOTED', 'AGREED')
      AND updated_at < ${quietCutoff.toISOString()}::timestamptz
      AND updated_at >= ${staleCutoff.toISOString()}::timestamptz
  `);
  for (const row of quiet.rows as Array<{ id: string }>) {
    app.log.info({ leadId: row.id }, 'follow-up: quiet (4h-24h) — notify manager (Phase 4 hook)');
  }
}

/**
 * Wire the scheduler to Fastify's plugin lifecycle.
 *
 * Production: registered once from buildApp() after route plugins. The
 * `setInterval` handle is captured in lexical scope and cleared on `onClose`.
 *
 * Test: a) when NODE_ENV='test' we return early so vitest does not trip a
 * real interval on import; b) the dedicated fake-timer test registers in
 * NODE_ENV='production' mode and drives the interval via
 * `vi.advanceTimersByTime`.
 */
export function registerFollowUpScheduler(
  app: FastifyInstance & { config?: { NODE_ENV?: string }; db: Db }
): void {
  // Resolve NODE_ENV — tests may decorate `app.config` directly; production
  // reads from the imported module. Either path wins.
  const nodeEnv = app.config?.NODE_ENV ?? importedConfig.NODE_ENV;
  if (nodeEnv === 'test') return; // tests use followUpTick directly
  const handle = setInterval(() => {
    void followUpTick({ db: app.db, log: app.log, config: { NODE_ENV: nodeEnv } }).catch((e) => {
      app.log.error({ err: e }, 'follow-up.tick_failed');
    });
  }, POLL_INTERVAL_MS);
  app.addHook('onClose', async () => {
    clearInterval(handle);
  });
}
