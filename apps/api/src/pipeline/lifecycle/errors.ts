// Phase 2 Plan 02-03 Task 1 — FSM error classes (CONTEXT D-29, RESEARCH.md §6).
//
// IllegalTransition  — thrown when the target stage/status is not allowed by
//                      LEAD_TRANSITIONS / ORDER_TRANSITIONS from the current state.
// VersionMismatch    — thrown when the compare-and-set UPDATE returns 0 rows,
//                      meaning another transaction won the race.
//
// Both carry a discriminating `code` literal so callers can branch on it without
// instanceof checks (useful in route handlers that catch the error and map to HTTP).

export class IllegalTransition extends Error {
  readonly code = 'illegal_transition' as const;
  constructor(message: string) {
    super(message);
    this.name = 'IllegalTransition';
  }
}

export class VersionMismatch extends Error {
  readonly code = 'version_mismatch' as const;
  constructor(message: string) {
    super(message);
    this.name = 'VersionMismatch';
  }
}
