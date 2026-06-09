import 'node:process';
import { defineConfig } from 'drizzle-kit';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set when running drizzle-kit (load .env.local first)');
}

export default defineConfig({
  schema: './src/persistence/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
  // Tell drizzle-kit that PostGIS owns these objects so it ignores them on diff
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
