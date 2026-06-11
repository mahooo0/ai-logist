// Phase 5 Plan 05-03 — POLISH-01 extractRequest byte-stable snapshots.
//
// All 20 canonical inputs from apps/api/tests/fixtures/canonical-inputs.json
// driven through extractRequestHandler with MockAnthropicClient. Mock fixtures
// live in apps/api/tests/fixtures/llm-responses.json (seeded for every canonical
// input by Plan 05-03; 6 from Phase 2, 14 added in Wave 3).
//
// Stability levers (Pitfall §3):
//   - FIXED_NOW from tests/_helpers/fake-timers.ts (auto-loaded via vitest config).
//   - MockAnthropicClient reads from fixtures keyed by sha256_prefix(systemPrompt + lastUser).
//   - Snapshot only validated ExtractRequestOutput fields — no created_at, no UUIDs.
//
// Run 10× via `pnpm --filter @ai-logist/api test:snapshot`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type ExtractRequestOutput,
  extractRequestHandler,
} from '../../src/pipeline/llm-tools/extract-request.js';
import type { ToolContext } from '../../src/pipeline/llm-tools/index.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';

interface CanonicalInput {
  id: string;
  messages: Array<{ from: string; text: string }>;
  expect?: Record<string, unknown>;
}

const inputsPath = fileURLToPath(
  new URL('../fixtures/canonical-inputs.json', import.meta.url)
);
const INPUTS = JSON.parse(readFileSync(inputsPath, 'utf8')) as CanonicalInput[];

// Minimal ToolContext stub — handler never touches db / llm via ctx in this code path.
type MinimalCtx = Pick<ToolContext, 'log' | 'leadId' | 'clientId' | 'clientLang'>;

function makeCtx(): MinimalCtx {
  const noop = () => {};
  const childLog: MinimalCtx['log'] = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    silent: noop,
    level: 'info',
    child: () => childLog,
  } as unknown as MinimalCtx['log'];
  return {
    log: childLog,
    leadId: '00000000-0000-4000-8000-000000000099',
    clientId: '00000000-0000-4000-8000-000000000098',
    clientLang: 'ru',
  };
}

/** Deterministic serializer — bigint → string + drop any non-serializable surface. */
function snapshotShape(id: string, out: ExtractRequestOutput): Record<string, unknown> {
  return {
    id,
    from_city: out.from_city,
    to_city: out.to_city,
    tons: out.tons,
    body_type: out.body_type,
    budget_kopecks:
      out.budget_kopecks === null ? null : out.budget_kopecks.toString(),
    deadline_iso: out.deadline_iso,
    confidence: out.confidence,
    clarifying_question_ru: out.clarifying_question_ru,
    clarifying_question_ua: out.clarifying_question_ua,
  };
}

describe('snapshot: extractRequest — POLISH-01 byte stability (Mock LLM)', () => {
  for (const input of INPUTS) {
    it(`canonical input ${input.id}`, async () => {
      const ctx = makeCtx();
      const llm = new MockAnthropicClient();
      // Drive last user-message text through extractRequest. Matches the
      // Phase 2 unit test pattern (apps/api/tests/unit/extract-request.test.ts).
      const lastText = input.messages.at(-1)?.text ?? '';
      const out = await extractRequestHandler({
        llm,
        ctx: ctx as ToolContext,
        text: lastText,
      });
      expect(snapshotShape(input.id, out)).toMatchSnapshot();
    });
  }
});
