// Phase 6 Wave 1 — live tests for Phase 6 callback regex (D-09).
// Plan: 06-01 Wave 1
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const PHASE6_CALLBACK_REGEX =
  /^(confirm_loading|decline_loading|confirm_delivery|decline_delivery):(.+)$/;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('telegram-callbacks', () => {
  describe('D-09 callback regex matches 4 new action prefixes', () => {
    it('matches all 4 new action prefixes with uuid payload', () => {
      for (const action of [
        'confirm_loading',
        'decline_loading',
        'confirm_delivery',
        'decline_delivery',
      ]) {
        const m = `${action}:abc-uuid-123`.match(PHASE6_CALLBACK_REGEX);
        expect(m, `action=${action}`).not.toBeNull();
        expect(m![1]).toBe(action);
        expect(m![2]).toBe('abc-uuid-123');
      }
    });

    it('does NOT match Phase 3 client prefix "confirm:abc"', () => {
      expect('confirm:abc'.match(PHASE6_CALLBACK_REGEX)).toBeNull();
    });

    it('does NOT match Phase 3 driver prefix "driver_accept:abc"', () => {
      expect('driver_accept:abc'.match(PHASE6_CALLBACK_REGEX)).toBeNull();
    });

    it('does NOT match "reject:abc" (Phase 3 prefix)', () => {
      expect('reject:abc'.match(PHASE6_CALLBACK_REGEX)).toBeNull();
    });

    it('does NOT match empty payload "::"', () => {
      expect('confirm_loading:'.match(PHASE6_CALLBACK_REGEX)).toBeNull();
    });
  });

  describe('handlers.ts source verification', () => {
    it('handlers.ts contains the exact Phase 6 regex', async () => {
      const handlersPath = path.resolve(
        __dirname,
        '../../src/channels/telegram/handlers.ts'
      );
      const src = await fs.readFile(handlersPath, 'utf8');
      expect(src).toContain(
        '/^(confirm_loading|decline_loading|confirm_delivery|decline_delivery):(.+)$/'
      );
    });

    it('handlers.ts contains handleDecline export', async () => {
      const handlersPath = path.resolve(
        __dirname,
        '../../src/channels/telegram/handlers.ts'
      );
      const src = await fs.readFile(handlersPath, 'utf8');
      expect(src).toContain('handleDecline');
    });
  });
});
