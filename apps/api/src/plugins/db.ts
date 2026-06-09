import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import fp from 'fastify-plugin';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from '../persistence/schema/index.js';

const { Pool } = pg;

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    pgPool: pg.Pool;
  }
}

/**
 * Fastify plugin: registers a node-postgres Pool + Drizzle client on the app.
 * Smoke-tests the connection on boot — fails fast if Postgres is unreachable.
 * Per CONTEXT D-07 / D-08: thin repos and raw `db.execute(sql\`…\`)` for PostGIS.
 */
export const dbPlugin = fp(
  async (app) => {
    const pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });

    // Smoke-test on boot — fail fast if DB is down
    await pool.query('SELECT 1');

    const db = drizzle(pool, { schema });

    app.decorate('db', db);
    app.decorate('pgPool', pool);

    app.addHook('onClose', async () => {
      await pool.end();
    });
  },
  { name: 'db' }
);
