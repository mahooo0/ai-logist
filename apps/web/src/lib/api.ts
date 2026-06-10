// apps/web/src/lib/api.ts
// Server Component fetcher with Zod boundary validation.
// D-14: Validates response via shared-types Zod schema; throws with payload snippet.
// D-17: Auto-routes — server → API_INTERNAL_URL; client → relative /api/...
import type { z } from 'zod';

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';

export async function apiGet<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit
): Promise<z.infer<T>> {
  const isServer = typeof window === 'undefined';
  const base = isServer ? `${INTERNAL_BASE}/api` : '/api';
  const url = `${base}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`apiGet ${path} ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `apiGet ${path} schema mismatch: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`
    );
  }
  return parsed.data;
}
