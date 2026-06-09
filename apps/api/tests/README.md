# apps/api tests

Three categories — keep boundaries clean:

| Category | Path | Speed | Needs Docker? | When to run |
|----------|------|-------|---------------|-------------|
| **unit** | `tests/unit/**`, `src/**/*.test.ts` | < 1s/test | no | per commit |
| **integration** | `tests/integration/**` | 10-30s/test (testcontainers boot) | yes | per wave merge |
| **smoke** | `tests/smoke/**` | 30-60s/test (full app boot) | yes | before `/gsd:verify-work` |

## Commands

```bash
pnpm --filter @ai-logist/api test               # all categories
pnpm --filter @ai-logist/api test:unit          # fast feedback
pnpm --filter @ai-logist/api test:integration   # needs Docker
pnpm --filter @ai-logist/api test:smoke         # needs Docker + built app
pnpm --filter @ai-logist/api test:watch         # dev loop
```

## Test fixtures

`tests/_helpers/test-db.ts` boots a real PostGIS container per integration suite. Use:

```typescript
import { startPostgisContainer, getTestDb, stopPostgisContainer } from '../_helpers/test-db.js';

beforeAll(async () => { await startPostgisContainer(); });
afterAll(async () => { await stopPostgisContainer(); });

it('uses a real PostGIS', async () => {
  const db = getTestDb();
  // … your test
});
```
