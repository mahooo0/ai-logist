// Boot-time idempotent runner for hand-written SQL migrations that
// drizzle-kit cannot apply (e.g. ALTER TYPE ADD VALUE — Postgres forbids
// those inside a transaction, but drizzle-kit wraps every migration in
// BEGIN/COMMIT). Every statement must guard with IF NOT EXISTS so re-running
// on every boot is a cheap no-op once applied.
//
// Currently runs: 0006_order_lifecycle.sql.
//
// Wired from app.ts AFTER dbPlugin and BEFORE any route that uses the new
// columns/enums.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

const FILES = ['0006_order_lifecycle.sql'];

/**
 * Resolve the drizzle directory robustly across `tsx` (source) and `node dist`
 * (compiled). At runtime in Docker the cwd is `/app/apps/api` and `drizzle/`
 * sits beside `dist/`. During local `tsx` it sits beside `src/`. Try both
 * relative paths plus an absolute fallback from `process.cwd()`.
 */
function resolveDrizzleDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '..', '..', 'drizzle'),        // src/lib/ → apps/api/drizzle (tsx mode)
    path.resolve(here, '..', '..', '..', 'drizzle'),  // dist/src/lib/ → apps/api/drizzle (compiled)
    path.resolve(process.cwd(), 'drizzle'),           // cwd fallback (runtime WORKDIR is apps/api)
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0] as string;
}

function splitStatements(sql: string): string[] {
  // Strip line comments, then split on ';' boundaries. Hand-written files
  // here are single-statement-per-line so this naive split is safe.
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function applyHandRolledMigrations(
  pool: pg.Pool,
  log: FastifyBaseLogger
): Promise<void> {
  const drizzleDir = resolveDrizzleDir();
  log.info({ drizzleDir }, 'hand-rolled-migration: resolved drizzle dir');
  for (const file of FILES) {
    const filePath = path.join(drizzleDir, file);
    let sql: string;
    try {
      sql = readFileSync(filePath, 'utf8');
    } catch (err) {
      log.warn({ err: String(err), filePath }, 'hand-rolled-migration: file not found, skipping');
      continue;
    }
    const statements = splitStatements(sql);
    log.info({ file, count: statements.length }, 'hand-rolled-migration: applying');
    for (const stmt of statements) {
      try {
        // Autocommit per-statement — pool.query runs outside any tx so
        // ALTER TYPE ADD VALUE is allowed.
        await pool.query(stmt);
      } catch (err) {
        log.error({ err: String(err), stmt: stmt.slice(0, 120), file }, 'hand-rolled-migration: statement failed');
        throw err;
      }
    }
    log.info({ file }, 'hand-rolled-migration: complete');
  }
}
