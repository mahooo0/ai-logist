import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from './config.js';
import type * as schema from './persistence/schema/index.js';

const { Pool } = pg;

export type Db = NodePgDatabase<typeof schema>;

/** Create a node-postgres Pool from DATABASE_URL */
export function createPool(connectionString = config.DATABASE_URL): pg.Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

/** Create a Drizzle client decorated with our schema barrel */
export async function createDb(pool: pg.Pool): Promise<Db> {
  const schemaModule = await import('./persistence/schema/index.js');
  return drizzle(pool, { schema: schemaModule });
}
