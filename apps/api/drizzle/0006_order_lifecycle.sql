-- 0006_order_lifecycle.sql — Phase 6 enum + column extensions.
--
-- *** MANUAL APPLY REQUIRED — DO NOT USE drizzle-kit migrate ***
-- PostgreSQL forbids ALTER TYPE ADD VALUE inside a transaction block.
-- drizzle-kit migrate wraps each migration file in BEGIN/COMMIT and will fail with:
--   "ERROR: ALTER TYPE ... ADD cannot run inside a transaction block"
--
-- Apply procedure:
--   psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql
--
-- This is the same pattern Phase 5 used for its enum extensions. The
-- schema-introspect-phase6 integration test asserts all new enum values
-- + the auto_progress_paused column exist after apply.

-- Extend order_status enum with three Phase 6 statuses (D-10).
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERED_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELED';

-- Extend order_event_type enum (Pitfall 4 — distinct types per leg).
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'approach_notified';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'loading_prompted';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'loading_confirmed';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'loading_declined';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'delivery_approach_notified';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'delivery_prompted';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'delivery_confirmed';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'delivery_declined';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'payment_link_sent';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'reminder_sent';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'operator_escalated';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'admin_override';
ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'closed';

-- Extend webhook_source for Stripe (D-18 idempotency reuses webhook_updates table).
ALTER TYPE webhook_source ADD VALUE IF NOT EXISTS 'stripe';

-- D-21 — auto_progress_paused column. Default false so existing rows pass NOT NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_progress_paused BOOLEAN NOT NULL DEFAULT false;
