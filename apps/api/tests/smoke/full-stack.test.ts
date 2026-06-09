import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const ENABLED = process.env.AI_LOGIST_FULL_STACK_SMOKE === '1';
const describeOrSkip = ENABLED ? describe : describe.skip;

describeOrSkip('Full-stack smoke (requires `docker compose up -d`)', () => {
  // Caddy maps :80 → api:3000 for /api/*
  const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost';

  beforeAll(() => {
    if (!ENABLED) {
      console.log('Set AI_LOGIST_FULL_STACK_SMOKE=1 + docker compose up -d to enable');
    }
  });

  afterAll(() => {});

  test('GET /api/health via Caddy → 200 + PostGIS 3.5.x', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: { db: string; postgis: string; redis: string };
    };
    expect(body.status).toBe('ok');
    expect(body.checks.db).toBe('ok');
    expect(body.checks.postgis).toMatch(/3\.5/);
    expect(body.checks.redis).toBe('ok');
  });

  test('GET /api/docs/json (or /openapi.json) via Caddy → OpenAPI surface', async () => {
    let res = await fetch(`${baseUrl}/api/docs/json`);
    if (res.status === 404) res = await fetch(`${baseUrl}/api/docs/openapi.json`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paths: Record<string, unknown> };
    const paths = Object.keys(body.paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining(['/api/health', '/api/leads', '/api/orders', '/api/trucks'])
    );
  });

  test('GET / via Caddy → Next.js placeholder', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('AI-Логист');
  });
});
