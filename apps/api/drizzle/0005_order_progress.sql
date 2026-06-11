-- 0005_order_progress.sql
-- Add a free-form route progress percent to orders, independent of the
-- order_status FSM. Driven by /dashboard/tracking (slider + draggable
-- truck marker) and persisted so the position survives a reload.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS progress_percent SMALLINT NOT NULL DEFAULT 0
  CHECK (progress_percent BETWEEN 0 AND 100);
