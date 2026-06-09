# Phase 2 Test Harness — Usage

Wave 0 shipped the deterministic test infrastructure for Phase 2's LLM pipeline + FSM
work. This page is the developer-facing API for the harness.

## Helpers (apps/api/tests/_helpers/)

| File                  | Provides                                                                            |
| --------------------- | ----------------------------------------------------------------------------------- |
| `dialog-harness.ts`   | `runScript(db, llm, clientId, messages)` — end-to-end dialog driver, no webhook    |
| `mock-anthropic.ts`   | `LlmProvider` interface + `MockAnthropicClient` keyed by sha256(systemPrompt + lastUser) |
| `fake-timers.ts`      | Centralized `vi.useFakeTimers` preset at `FIXED_NOW = 2026-06-09T12:00:00Z`         |
| `db-seed.ts`          | `DETERMINISTIC_UUIDS` (20 fixed v4 UUIDs) + `installDeterministicCrypto()`         |
| `test-db.ts`          | (Phase 1) testcontainers PostGIS 17-3.5 boot/teardown                              |

`fake-timers.ts` is registered via `vitest.config.ts` `setupFiles` for the **unit** project
only — integration suites manage their own clocks because testcontainers + real DB cannot
freeze `Date`.

## Driving a scripted dialog

```ts
import { runScript } from '../_helpers/dialog-harness.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';

const llm = new MockAnthropicClient();
const result = await runScript(db, llm, clientId, [
  { from: 'client', text: 'Киев-Львов 18 тонн тент, нужно завтра' },
]);

expect(result.finalLead.stage).toBe('ORDER_CREATED');
expect(result.finalOrder?.status).toBe('CREATED');
expect(result.conversation).toMatchSnapshot();
```

`runScript` calls `pipeline/intake.ts#handleInboundMessage` dynamically — the file does
not need to exist for tests that don't actually call `runScript` to type-check. Wave 3
ships the real `intake.ts` and the harness then works end-to-end.

## Adding a fixture to `llm-responses.json`

The mock LLM resolves responses by deterministic key:

```
${toolNames.join(',')}::${sha256(systemPrompt + '\n---\n' + lastUserMessage).slice(0, 16)}
```

To capture a new fixture:

1. Run the test once and let `MockAnthropicClient` throw — the error includes the missing
   key string.
2. Compute the response (typically by hand for unit tests, or once against the real
   Anthropic API during smoke).
3. Add an entry to `apps/api/tests/fixtures/llm-responses.json`:

```json
{
  "extractRequest::a1b2c3d4e5f6a7b8": {
    "toolCalls": [{ "name": "extractRequest", "args": { "from_city": "Киев" } }],
    "finalText": null,
    "usage": { "input_tokens": 120, "output_tokens": 40 }
  }
}
```

JSON files MUST be valid JSON (no comments). Biome formats them on `pnpm exec biome
format --write`.

## Flipping a `test.todo()` to a real assertion

`apps/api/tests/unit/phase-2-stubs.test.ts` carries exactly **18** `test.todo()` markers,
one per Phase 2 requirement ID. As production code lands wave-by-wave, the executor
replaces the matching `test.todo(...)` with:

```ts
it('LOGIC-02: Cyrillic UA-markers → "ua"; default → "ru"; <20 chars → no detect', async () => {
  const { cyrillicHeuristic } = await import('../../src/lib/lang-detect.js');
  expect(cyrillicHeuristic('Київ-Львів 18т')).toEqual({
    lang: 'ua',
    confidence: 1.0,
    source: 'cyrillic_heuristic',
  });
  expect(cyrillicHeuristic('Киев-Львов 18т')).toBeNull();
});
```

The phase-2-stubs.test.ts file count gate is `grep -c 'test.todo' phase-2-stubs.test.ts`
and starts at 18; each wave that flips an item updates the count downward. Phase 2 is
complete when count == 0.

## Snapshot stability protocol

Every snapshot test that touches `Date.now()` or `crypto.randomUUID` must run inside the
`unit` project (so the fake-timers setupFile applies) AND call:

```ts
import { beforeEach, afterEach } from 'vitest';
import { resetDeterministicUuids, installDeterministicCrypto } from '../_helpers/db-seed.js';

let restoreCrypto: () => void;

beforeEach(() => {
  resetDeterministicUuids();
  restoreCrypto = installDeterministicCrypto();
});

afterEach(() => {
  restoreCrypto();
});
```

After this, `crypto.randomUUID()` returns `00000000-0000-4000-8000-000000000001`, `…002`,
… deterministically; `Date.now()` is pinned to `2026-06-09T12:00:00Z`.

Snapshot tests prove deterministic across 10 repeats via:

```bash
pnpm --filter @ai-logist/api test:snapshot
```

(Vitest `--repeat=10 -t snapshot`.)

## Mocked vs real LLM tests

| Test type              | LLM client          | Gating                                 |
| ---------------------- | ------------------- | -------------------------------------- |
| Unit + snapshot        | `MockAnthropicClient` | always — no API key required           |
| Integration (default)  | `MockAnthropicClient` | always — testcontainers + mock         |
| `test:llm` (smoke)     | Real `@anthropic-ai/sdk` | gated on `ANTHROPIC_API_KEY` env       |

Wave 0 deliberately ships **no real-LLM tests**. The first real-LLM smoke ships in Wave 2
once `extractRequest` is implemented; until then, `test:llm` is a placeholder that runs
0 tests on a missing API key.
