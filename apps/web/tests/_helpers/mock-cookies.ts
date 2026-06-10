// Mock next/headers cookies() — used by proxy.ts auth tests + login route tests.
import { vi } from 'vitest';

const store = new Map<string, string>();

export function mockCookies(initial?: Record<string, string>) {
  store.clear();
  if (initial) for (const [k, v] of Object.entries(initial)) store.set(k, v);

  vi.mock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => {
        const v = store.get(name);
        return v ? { name, value: v } : undefined;
      },
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      },
    }),
  }));
}

export function getMockCookieStore() {
  return store;
}
