// Keyed-by-URL fetch mock. Each test registers expected URL → response.
import { vi } from 'vitest';

type MockResponse = { status?: number; body: unknown };
const routes = new Map<string, MockResponse>();

export function mockFetch(url: string, response: MockResponse) {
  routes.set(url, response);
}

export function installMockFetch() {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = routes.get(url);
    if (!match) {
      throw new Error(`mock-api: no route registered for ${url}`);
    }
    return new Response(JSON.stringify(match.body), {
      status: match.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

export function resetMockFetch() {
  routes.clear();
  vi.restoreAllMocks();
}
