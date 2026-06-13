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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

const FILES = ['0006_order_lifecycle.sql'];

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
  for (const file of FILES) {
    const path = fileURLToPath(new URL(`../../drizzle/${file}`, import.meta.url));
    let sql: string;
    try {
      sql = readFileSync(path, 'utf8');
    } catch (err) {
      log.warn({ err: String(err), file }, 'hand-rolled-migration: file not found, skipping');
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
