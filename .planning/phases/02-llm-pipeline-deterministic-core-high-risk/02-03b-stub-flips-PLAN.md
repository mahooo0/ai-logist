---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 03b
type: execute
wave: 3
depends_on:
  - "02-02"
  - "02-03"
files_modified:
  - apps/api/tests/unit/phase-2-stubs.test.ts
autonomous: true
requirements:
  - LOGIC-01
  - LOGIC-05
  - MATCH-01
  - MATCH-03
  - MATCH-05
  - FSM-01
  - FSM-02
  - FSM-03
  - FSM-05

must_haves:
  truths:
    - "After this plan runs, phase-2-stubs.test.ts contains 9 real it() assertions previously marked as test.todo()."
    - "Flipped todos: LOGIC-01, LOGIC-05 (from Plan 02-02 Task 1); MATCH-01, MATCH-03, MATCH-05 (from Plan 02-02 Task 2); FSM-01 (02-03 Task 1), FSM-02 (02-03 Task 2), FSM-03 + FSM-05 (02-03 Task 3)."
    - "phase-2-stubs.test.ts after this plan has exactly 5 test.todo markers remaining: LOGIC-02, LOGIC-03, LOGIC-04, MATCH-02, MATCH-04, MATCH-06, FSM-04, FSM-06, API-07 → wait, the original Wave-1 plan already flipped LOGIC-02, MATCH-02, MATCH-04, MATCH-06. So remaining post-this-plan = 5: LOGIC-03, LOGIC-04, FSM-04, FSM-06, API-07 (correctly handled by Wave 3 + 4)."
    - "Atomic commit — all 9 flips land in one commit so concurrent file modification on phase-2-stubs.test.ts is impossible."
  artifacts:
    - path: "apps/api/tests/unit/phase-2-stubs.test.ts"
      provides: "phase-2-stubs.test.ts with 9 real assertions + 5 remaining todos"
      contains: "LOGIC-01"
  key_links:
    - from: "tests/unit/phase-2-stubs.test.ts"
      to: "src/pipeline/llm-tools/extract-request.ts"
      via: "import ExtractRequestSchema for LOGIC-01 and LOGIC-05 assertions"
      pattern: "ExtractRequestSchema|extract-request"
    - from: "tests/unit/phase-2-stubs.test.ts"
      to: "src/pipeline/lifecycle/lead-fsm.ts"
      via: "import LEAD_TRANSITIONS for FSM-01 assertion"
      pattern: "LEAD_TRANSITIONS|lead-fsm"
---

<objective>
Wave 3 (pre-pipeline) micro-plan — atomic todo flips for the 9 requirements covered by Plans 02-02 + 02-03.

Purpose:
- BLOCKER #2 fix: Plans 02-02 and 02-03 originally both modified `phase-2-stubs.test.ts` in Wave 2 parallel execution, causing a write race. This dedicated micro-plan owns ALL Wave-2 todo flips in one atomic commit, executed serially after 02-02 + 02-03 land.
- Single file modification; single commit; no parallelism conflicts.

Scope: Replace 9 `test.todo()` markers with real `it()` assertions:
- LOGIC-01 (extractRequest schema) — uses Plan 02-02 Task 1's `extract-request.ts`
- LOGIC-05 (strict mode rejects unknown fields) — uses Plan 02-02 Task 1's `ExtractRequestSchema.strict()`
- MATCH-01 (KNN re-rank sanity) — uses Plan 02-02 Task 2's `nearestTruck` (sanity: SQL string contains expected pattern)
- MATCH-03 (calcPrice determinism sanity) — uses Plan 02-02 Task 2's `calcPrice` pure function
- MATCH-05 (corridor sanity) — uses Plan 02-02 Task 2's `calcPrice` corridor output
- FSM-01 (LEAD_TRANSITIONS table) — uses Plan 02-03 Task 1
- FSM-02 (ORDER_TRANSITIONS table) — uses Plan 02-03 Task 2
- FSM-03 (concurrency reference) — sanity check pointing at Plan 02-03 Task 3 integration test
- FSM-05 (audit log reference) — sanity check pointing at Plan 02-03 Task 3 integration test

NOTE: Plan 02-01 already flipped LOGIC-02, MATCH-02, MATCH-04, MATCH-06 (Wave 1). Plans 02-04a + 02-04b flip LOGIC-03, LOGIC-04, FSM-04, FSM-06. Plan 02-05 flips API-07. Total: 4 (W1) + 9 (this plan) + 4 (W3+W4) + 1 (W5) = 18 ✓.

Output: phase-2-stubs.test.ts with 9 real assertions added, 5 todos remaining (LOGIC-03, LOGIC-04, FSM-04, FSM-06, API-07).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-02-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03-SUMMARY.md
@apps/api/src/pipeline/llm-tools/extract-request.ts
@apps/api/src/pipeline/llm-tools/nearest-truck.ts
@apps/api/src/pipeline/llm-tools/calc-price.ts
@apps/api/src/pipeline/lifecycle/lead-fsm.ts
@apps/api/src/pipeline/lifecycle/order-fsm.ts
@apps/api/src/pipeline/lifecycle/errors.ts
@apps/api/tests/unit/phase-2-stubs.test.ts

<interfaces>
<!-- Plan 02-02 + 02-03 exports this micro-plan consumes for sanity assertions. -->

ExtractRequestSchema (Plan 02-02 Task 1):
```typescript
export const ExtractRequestSchema: z.ZodObject<{
  from_city: ...; to_city: ...; tons: ...; body_type: ...;
  budget_kopecks: ...; deadline_iso: ...;
  confidence: ...;
  clarifying_question_ru: ...; clarifying_question_ua: ...;
}>;
```

LEAD_TRANSITIONS (Plan 02-03 Task 1):
```typescript
export const LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW: ['QUALIFIED', 'LOST'],
  QUOTED: ['AGREED', 'LOST'],
  // ... 9 keys total
};
```

ORDER_TRANSITIONS (Plan 02-03 Task 2):
```typescript
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['DRIVER_ASSIGNED'],
  // ... 7 keys total
};
```

VersionMismatch (Plan 02-03 Task 1):
```typescript
export class VersionMismatch extends Error { readonly code = 'version_mismatch' }
```

calcPrice (Plan 02-02 Task 2):
```typescript
export function calcPrice(input, cfg): { default: bigint; min: bigint; max: bigint; breakdown };
```

leadEventsRepo (Wave 1):
```typescript
export const leadEventsRepo: { appendEvent, listByLead };
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Atomic flip of 9 todos in phase-2-stubs.test.ts</name>
  <files>apps/api/tests/unit/phase-2-stubs.test.ts</files>
  <read_first>
    - apps/api/tests/unit/phase-2-stubs.test.ts (current state: 4 flipped by Wave 1 plan 02-01, 9 todos to flip here, 5 remain for Waves 3-5)
    - apps/api/src/pipeline/llm-tools/extract-request.ts (ExtractRequestSchema for LOGIC-01/05)
    - apps/api/src/pipeline/llm-tools/calc-price.ts (calcPrice for MATCH-03/05)
    - apps/api/src/pipeline/llm-tools/nearest-truck.ts (read source for MATCH-01 sanity grep)
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (LEAD_TRANSITIONS, VersionMismatch for FSM-01/03)
    - apps/api/src/pipeline/lifecycle/order-fsm.ts (ORDER_TRANSITIONS for FSM-02)
    - apps/api/src/persistence/repos/lead_events.ts (leadEventsRepo for FSM-05)
  </read_first>
  <action>
    Open `apps/api/tests/unit/phase-2-stubs.test.ts`. Add imports at the top (after existing imports from 02-01):
    ```ts
    import { ExtractRequestSchema } from '../../src/pipeline/llm-tools/extract-request.js';
    import { calcPrice } from '../../src/pipeline/llm-tools/calc-price.js';
    import { LEAD_TRANSITIONS } from '../../src/pipeline/lifecycle/lead-fsm.js';
    import { ORDER_TRANSITIONS } from '../../src/pipeline/lifecycle/order-fsm.js';
    import { VersionMismatch } from '../../src/pipeline/lifecycle/errors.js';
    import { leadEventsRepo } from '../../src/persistence/repos/index.js';
    import { readFile } from 'node:fs/promises';
    ```

    Replace EXACTLY 9 `test.todo()` lines with the following real `it()` blocks (paste below their original comment markers — preserve LOGIC-01..API-07 comment ordering from Wave 0):

    ```ts
    // LOGIC-01 — extractRequest via Anthropic betaZodTool (was: test.todo)
    it('LOGIC-01: extractRequest parses canonical inputs into ExtractRequestOutput', () => {
      const valid = {
        from_city: 'Киев', to_city: 'Львов', tons: 18, body_type: 'tent' as const,
        budget_kopecks: null, deadline_iso: null,
        confidence: { from_city: 1, to_city: 1, tons: 1 },
        clarifying_question_ru: null, clarifying_question_ua: null,
      };
      const parsed = ExtractRequestSchema.parse(valid);
      expect(parsed.from_city).toBe('Киев');
      expect(parsed.confidence.tons).toBe(1);
    });

    // LOGIC-05 — strict JSON, unknown fields rejected (was: test.todo)
    it('LOGIC-05: malformed LLM output → strict schema rejects unknown fields', () => {
      const withExtra = {
        from_city: 'Киев', to_city: 'Львов', tons: 18, body_type: 'tent' as const,
        budget_kopecks: null, deadline_iso: null,
        confidence: { from_city: 1, to_city: 1, tons: 1 },
        clarifying_question_ru: null, clarifying_question_ua: null,
        manager_override: true,  // injection attempt
      };
      expect(() => ExtractRequestSchema.strict().parse(withExtra)).toThrow();
    });

    // MATCH-01 — KNN CTE re-rank (was: test.todo)
    it('MATCH-01: nearestTruck source contains CTE re-rank pattern (geom <-> + spheroid)', async () => {
      const src = await readFile('src/pipeline/llm-tools/nearest-truck.ts', 'utf8');
      expect(src).toMatch(/ORDER BY.*geom.*<->/);
      expect(src).toMatch(/ST_Distance.*true/);
      expect(src).toMatch(/WHERE.*status = 'available'/);
      // EXPLAIN ANALYZE assertion lives in tests/integration/nearest-truck-knn.test.ts
    });

    // MATCH-03 — deterministic calcPrice (was: test.todo)
    it('MATCH-03: calcPrice deterministic kopecks output', () => {
      const cfg = {
        rate_per_km_kopecks: 4200n,
        dir_coef: { default: 1.0, back_haul: 0.85 },
        season_coef: () => 1.0,
      };
      const a = calcPrice({ route_km: 540, tons: 18, bodyType: 'tent', date: new Date('2026-06-09'), direction: 'default' }, cfg);
      const b = calcPrice({ route_km: 540, tons: 18, bodyType: 'tent', date: new Date('2026-06-09'), direction: 'default' }, cfg);
      expect(a.default).toBe(b.default);
      expect(a.default > 0n).toBe(true);
    });

    // MATCH-05 — corridor min/max (was: test.todo)
    it('MATCH-05: calcPrice returns {min, default, max} with × 0.85 / × 1.15', () => {
      const cfg = {
        rate_per_km_kopecks: 4200n,
        dir_coef: { default: 1.0, back_haul: 0.85 },
        season_coef: () => 1.0,
      };
      const out = calcPrice({ route_km: 540, tons: 18, bodyType: 'tent', date: new Date('2026-06-09'), direction: 'default' }, cfg);
      expect(out.min).toBeLessThan(out.default);
      expect(out.max).toBeGreaterThan(out.default);
      // Corridor ratio sanity (within rounding noise: 0.84 < min/default < 0.86; 1.14 < max/default < 1.16)
      const ratioMin = Number(out.min) / Number(out.default);
      const ratioMax = Number(out.max) / Number(out.default);
      expect(ratioMin).toBeGreaterThanOrEqual(0.84);
      expect(ratioMin).toBeLessThanOrEqual(0.86);
      expect(ratioMax).toBeGreaterThanOrEqual(1.14);
      expect(ratioMax).toBeLessThanOrEqual(1.16);
    });

    // FSM-01 — lead funnel transitions (was: test.todo)
    it('FSM-01: LEAD_TRANSITIONS has exactly 9 stages and table-driven', () => {
      expect(Object.keys(LEAD_TRANSITIONS)).toHaveLength(9);
      expect(LEAD_TRANSITIONS.NEW).toEqual(['QUALIFIED', 'LOST']);
      expect(LEAD_TRANSITIONS.DONE).toEqual([]);
      expect(LEAD_TRANSITIONS.LOST).toEqual([]);
    });

    // FSM-02 — order lifecycle transitions (was: test.todo)
    it('FSM-02: ORDER_TRANSITIONS has exactly 7 statuses and table-driven', () => {
      expect(Object.keys(ORDER_TRANSITIONS)).toHaveLength(7);
      expect(ORDER_TRANSITIONS.CREATED).toEqual(['DRIVER_ASSIGNED']);
      expect(ORDER_TRANSITIONS.CLOSED).toEqual([]);
    });

    // FSM-03 — concurrency (was: test.todo) — sanity reference; real proof in tests/integration/fsm-concurrency.test.ts (100 iterations)
    it('FSM-03: VersionMismatch class exported (concurrency proof in integration test)', () => {
      const v = new VersionMismatch('test');
      expect(v.code).toBe('version_mismatch');
      expect(LEAD_TRANSITIONS.QUOTED).toEqual(['AGREED', 'LOST']);
      // Integration coverage: tests/integration/fsm-concurrency.test.ts asserts 100/100 deterministic outcomes.
    });

    // FSM-05 — audit log (was: test.todo) — sanity reference; real proof in tests/integration/fsm-events-audit.test.ts
    it('FSM-05: leadEventsRepo exports appendEvent + listByLead (audit proof in integration test)', () => {
      expect(typeof leadEventsRepo.appendEvent).toBe('function');
      expect(typeof leadEventsRepo.listByLead).toBe('function');
      // Integration coverage: tests/integration/fsm-events-audit.test.ts asserts every transitionLead writes a row.
    });
    ```

    After replacement: phase-2-stubs.test.ts MUST have:
    - 9 real `it()` assertions added (these 9)
    - 4 real `it()` already added by Wave 1 (LOGIC-02, MATCH-02, MATCH-04, MATCH-06)
    - 5 `test.todo()` markers remaining (LOGIC-03, LOGIC-04, FSM-04, FSM-06, API-07)

    Run `pnpm --filter @ai-logist/api typecheck` + `pnpm --filter @ai-logist/api test:unit -- phase-2-stubs` and verify:
    - 13 it() blocks pass (4 from Wave 1 + 9 from this plan)
    - 5 test.todo remain
    - Zero failures

    Constraints:
    - Do NOT add new dependencies — all imports are from existing Wave 1/2 modules.
    - Preserve the original comment header for each requirement (// LOGIC-01 — …) above the it() block; that's how Wave 3/4/5 plans identify which todo to flip next.
    - This is THE ONLY file modification in this plan.
  </action>
  <verify>
    <automated>cd apps/api && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "5" && grep -q "LOGIC-01: extractRequest parses" tests/unit/phase-2-stubs.test.ts && grep -q "FSM-01: LEAD_TRANSITIONS" tests/unit/phase-2-stubs.test.ts && grep -q "FSM-02: ORDER_TRANSITIONS" tests/unit/phase-2-stubs.test.ts && grep -q "MATCH-03: calcPrice deterministic" tests/unit/phase-2-stubs.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- phase-2-stubs 2>&1 | tail -15</automated>
  </verify>
  <done>
    phase-2-stubs.test.ts has exactly 5 test.todo() markers remaining (LOGIC-03, LOGIC-04, FSM-04, FSM-06, API-07); 13 it() blocks pass (4 Wave-1 + 9 this plan); tsc + biome pass.
  </done>
</task>

</tasks>

<verification>
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm --filter @ai-logist/api test:unit -- phase-2-stubs` — 13 passing, 5 todo, 0 failures
3. `grep -c "test.todo" apps/api/tests/unit/phase-2-stubs.test.ts` = 5
4. `grep -c "^\s*it(" apps/api/tests/unit/phase-2-stubs.test.ts` ≥ 13
</verification>

<success_criteria>
- 9 todos flipped to real `it()` assertions in one atomic commit.
- Zero file conflict with Wave 2 (02-02 and 02-03 no longer write phase-2-stubs.test.ts).
- Remaining 5 todos correspond exactly to LOGIC-03, LOGIC-04, FSM-04, FSM-06, API-07 — owned by Wave 3 (intake), Wave 4 (intake + scheduler), Wave 5 (routes).
- All imports resolve (Plans 02-02 + 02-03 have shipped their source files by Wave 2 completion).
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03b-SUMMARY.md` documenting:
- 9 todos flipped (LOGIC-01, LOGIC-05, MATCH-01, MATCH-03, MATCH-05, FSM-01, FSM-02, FSM-03, FSM-05)
- 5 remaining (LOGIC-03, LOGIC-04 for 02-04a/02-04b; FSM-04 for 02-04b advisory lock test; FSM-06 for 02-04b scheduler test; API-07 for 02-05)
- Atomic-commit pattern preserves Wave 2 parallelism in 02-02 + 02-03 (no shared file writes during wave execution)
</output>
