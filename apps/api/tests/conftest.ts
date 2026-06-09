// Shared test wiring — re-exports the testcontainers helper.
// Import from here in tests/integration/** to avoid relative-path drift.
export {
  startPostgisContainer,
  stopPostgisContainer,
  getTestDb,
  getTestDbUrl,
} from './_helpers/test-db.js';
