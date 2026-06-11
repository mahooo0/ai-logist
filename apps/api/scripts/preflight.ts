#!/usr/bin/env tsx
// apps/api/scripts/preflight.ts
//
// Phase 5 POLISH-05 — Demo green-light preflight script.
//
// 6 SEQUENTIAL fail-fast checks per CONTEXT D-34 verbatim:
//   1. Telegram bot alive     — bot.api.getMe() returns username
//   2. Twilio number registered — twilio.incomingPhoneNumbers.list({phoneNumber})
//   3. DB seeded              — SELECT count(*) FROM trucks WHERE status='available' >= 10
//   4. /api/health            — HTTP 200 + checks.postgis matches /^3\.5/
//   5. LLM key check          — anthropic.messages.create({max_tokens:1})
//   6. E2E smoke (RU + UA)    — POST /api/admin/simulate-call for ru_happy_path + ua_happy_path
//
// Total runtime budget: ≤30s.
//
// Output:
//   - Human mode (default): "✓ {name} ({duration}ms)" or "✗ {name}: {error}"
//   - JSON mode (--json):   { exitCode, results: [{name, status, duration_ms, error?}] }
//
// Exit codes: 0 on all-pass, 1 on first-fail (break — D-34 fail-fast).
//
// Run via root: `pnpm preflight` or directly:
//   tsx --env-file=../../.env.local scripts/preflight.ts
//   tsx --env-file=../../.env.local scripts/preflight.ts --json

import Anthropic from '@anthropic-ai/sdk';
import { Bot } from 'grammy';
import pg from 'pg';
import Twilio from 'twilio';
import { config } from '../src/config.js';

type Check = { name: string; fn: () => Promise<void> };

const checks: Check[] = [
  {
    name: 'Telegram bot alive',
    fn: async () => {
      if (!config.TELEGRAM_BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN not configured');
      }
      const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
      const me = await bot.api.getMe();
      if (!me.username) throw new Error('Telegram returned no username for bot');
    },
  },
  {
    name: 'Twilio number registered',
    fn: async () => {
      if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
        throw new Error('TWILIO_* env vars not configured (SID + token + phone number required)');
      }
      const tw = Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      const nums = await tw.incomingPhoneNumbers.list({
        phoneNumber: config.TWILIO_PHONE_NUMBER,
      });
      if (nums.length === 0) {
        throw new Error(`Twilio number ${config.TWILIO_PHONE_NUMBER} not registered in account`);
      }
    },
  },
  {
    name: 'DB seeded',
    fn: async () => {
      const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
      try {
        const { rows } = await pool.query(
          "SELECT COUNT(*)::int AS n FROM trucks WHERE status='available'"
        );
        const n = (rows[0] as { n: number } | undefined)?.n ?? 0;
        if (n < 10) {
          throw new Error(`only ${n} available trucks (need >=10) — run \`pnpm seed\` first`);
        }
      } finally {
        await pool.end();
      }
    },
  },
  {
    name: '/api/health',
    fn: async () => {
      const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiBase}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { checks?: { postgis?: string } };
      const postgis = json.checks?.postgis;
      if (!postgis || !/^3\.5/.test(postgis)) {
        throw new Error(
          `PostGIS version mismatch: expected /^3\\.5/, got ${postgis ?? 'undefined'}`
        );
      }
    },
  },
  {
    name: 'LLM key check',
    fn: async () => {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      const a = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
      await a.messages.create({
        model: config.LLM_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
    },
  },
  {
    name: 'E2E smoke (RU + UA via /api/admin/simulate-call)',
    fn: async () => {
      const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';
      for (const scenarioKey of ['ru_happy_path', 'ua_happy_path']) {
        const res = await fetch(`${apiBase}/api/admin/simulate-call`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenarioKey }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${scenarioKey}: status ${res.status} body=${txt.slice(0, 200)}`);
        }
        const body = (await res.json()) as { orderId?: string };
        if (!body.orderId) {
          throw new Error(`${scenarioKey}: simulate-call produced no orderId`);
        }
      }
    },
  },
];

const useJson = process.argv.includes('--json');
const results: Array<{
  name: string;
  status: 'pass' | 'fail';
  duration_ms: number;
  error?: string;
}> = [];
let exitCode = 0;

for (const check of checks) {
  const t0 = Date.now();
  try {
    await check.fn();
    const duration = Date.now() - t0;
    results.push({ name: check.name, status: 'pass', duration_ms: duration });
    if (!useJson) console.log(`✓ ${check.name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name: check.name, status: 'fail', duration_ms: duration, error: msg });
    if (!useJson) console.error(`✗ ${check.name}: ${msg}`);
    exitCode = 1;
    break; // D-34 fail-fast
  }
}

if (useJson) {
  console.log(JSON.stringify({ exitCode, results }, null, 2));
} else {
  const total = results.reduce((sum, r) => sum + r.duration_ms, 0);
  if (exitCode === 0) {
    console.log(`\nAll ${checks.length} checks passed in ${total}ms. Demo green-light. ✓`);
  } else {
    console.log(
      `\nPreflight failed at check ${results.length} of ${checks.length}. Fix and re-run.`
    );
  }
}

process.exit(exitCode);
