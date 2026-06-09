import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;
let connectionUrl: string | null = null;

/**
 * Boot a real postgis/postgis:17-3.5 container.
 * Call in beforeAll(); pair with stopPostgisContainer() in afterAll().
 */
export async function startPostgisContainer(): Promise<string> {
  if (container && connectionUrl) return connectionUrl;
  container = await new PostgreSqlContainer('postgis/postgis:17-3.5')
    .withDatabase('ailogist_test')
    .withUsername('ailogist')
    .withPassword('ailogist')
    .withStartupTimeout(60_000)
    .start();
  connectionUrl = `${container.getConnectionUri()}?sslmode=disable`;
  return connectionUrl;
}

export async function stopPostgisContainer(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
    connectionUrl = null;
  }
}

export function getTestDbUrl(): string {
  if (!connectionUrl) throw new Error('Call startPostgisContainer() in beforeAll() first');
  return connectionUrl;
}

/**
 * Returns a Drizzle NodePgDatabase pointing at the test container.
 * Plan 01-03 installed drizzle-orm + pg, so the @ts-expect-error directives are removed.
 * Wave 0 callers may still rely on getTestDbUrl() + raw pg.Client only.
 */
export async function getTestDb(): Promise<unknown> {
  const url = getTestDbUrl();
  try {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: url });
    return drizzle(pool);
  } catch (_err) {
    throw new Error(
      'getTestDb requires drizzle-orm and pg to be installed. ' +
        'For Wave 0 tests, use getTestDbUrl() + new pg.Client() directly.'
    );
  }
}
