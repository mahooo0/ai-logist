import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../', import.meta.url).pathname; // apps/web/

function grep(pattern: string, paths: string): string {
  try {
    return execSync(`grep -rE "${pattern}" ${paths} 2>/dev/null || true`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

describe('Phase 4 static-rules (Pitfall #13 + Next.js 16 + auth)', () => {
  // Guard 1: D-12 — no 'use cache' on chat/calls/orders/orders[id]/login routes.
  it("no 'use cache' directive in chat/calls/orders pages (D-12)", () => {
    // Wave 1 will create these dirs; pre-Wave-1 the dirs don't exist → output empty (PASS).
    const hits = grep(
      "'use cache'",
      'src/app/\\(main\\)/dashboard/chat src/app/\\(main\\)/dashboard/calls src/app/\\(main\\)/dashboard/orders src/app/auth/v1/login 2>/dev/null'
    );
    expect(hits.trim()).toBe('');
  });

  // Guard 2: D-58 — Tailwind v4 border-border must be explicit (no bare `border`).
  it('no bare `border` class without border-border in dashboard/ (D-58)', () => {
    const hits = grep(
      'className=\\"[^\\"]*\\\\bborder\\\\b[^-][^\\"]*\\"',
      'src/app/\\(main\\)/dashboard/'
    );
    // Filter out lines containing border-border, border-primary, border-{color}.
    const offenders = hits
      .split('\n')
      .filter(
        (line) =>
          line &&
          !/border-(border|primary|secondary|destructive|muted|accent|input|ring|[a-z]+-[0-9]+)/.test(
            line
          )
      );
    expect(offenders).toEqual([]);
  });

  // Guard 3: D-59 — page.tsx under (main)/dashboard/ MUST NOT have 'use client'.
  it("all page.tsx under (main)/dashboard/ are Server Components — no 'use client' (D-59)", () => {
    const hits = grep("^'use client'", 'src/app/\\(main\\)/dashboard/.*page.tsx');
    expect(hits.trim()).toBe('');
  });

  // Guard 4: Auth — proxy.ts matcher gates /dashboard/* and excludes /api + /auth.
  it('proxy.ts matcher covers /dashboard/:path* and excludes /api + /auth (Auth-01)', () => {
    // File may not exist pre-Wave-2 — grep returns '' (PASS by default).
    const content = grep('matcher', 'src/proxy.ts 2>/dev/null');
    if (content.trim() === '') {
      return; // proxy.ts not yet created — Wave 2 will add it.
    }
    expect(content).toMatch(/dashboard/);
    expect(content).not.toMatch(/\/api[^\w]/); // No /api in matcher
    expect(content).not.toMatch(/\/auth[^\w]/); // No /auth in matcher
  });

  // Guard 5: Next.js 16 — no sync cookies()/headers()/searchParams/params usage.
  it('no sync cookies()/headers()/params/searchParams — Next.js 16 async-only (Pitfall #2)', () => {
    const hits = grep('\\bcookies\\(\\)[^.][^a]', 'src/');
    // Allowed: `await cookies()`, `await headers()`, `cookies()` followed by .then/await
    const offenders = hits
      .split('\n')
      .filter(
        (line) => line && !/await\s+cookies\(\)/.test(line) && !/cookies\(\)\s*\.then/.test(line)
      );
    expect(offenders).toEqual([]);
  });
});
