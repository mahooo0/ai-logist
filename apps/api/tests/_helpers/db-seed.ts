// apps/api/tests/_helpers/db-seed.ts
// Deterministic UUID generator for snapshot stability (RESEARCH.md Pitfall #7 fix).
//
// All 20 UUIDs are RFC 4122 v4-compliant:
//   - third group starts with `4` (version 4 marker)
//   - fourth group starts with `8` (variant bits 10xx — DCE 1.1 / RFC 4122)
// The trailing 12-hex group encodes a 1..20 counter.

let counter = 0;

export const DETERMINISTIC_UUIDS: readonly string[] = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-00000000000b',
  '00000000-0000-4000-8000-00000000000c',
  '00000000-0000-4000-8000-00000000000d',
  '00000000-0000-4000-8000-00000000000e',
  '00000000-0000-4000-8000-00000000000f',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000014',
];

export function resetDeterministicUuids(): void {
  counter = 0;
}

export function nextUuid(): string {
  const u = DETERMINISTIC_UUIDS[counter];
  if (!u) {
    throw new Error(`DETERMINISTIC_UUIDS exhausted at ${counter}`);
  }
  counter += 1;
  return u;
}

/**
 * Monkey-patch crypto.randomUUID for snapshot stability.
 * Returns a teardown function the caller MUST invoke (e.g. in afterEach) to restore the
 * original implementation. Tests using this helper should also call resetDeterministicUuids()
 * before each test so the counter starts from zero.
 */
export function installDeterministicCrypto(): () => void {
  const orig = globalThis.crypto.randomUUID;
  globalThis.crypto.randomUUID = nextUuid as typeof crypto.randomUUID;
  return () => {
    globalThis.crypto.randomUUID = orig;
  };
}
