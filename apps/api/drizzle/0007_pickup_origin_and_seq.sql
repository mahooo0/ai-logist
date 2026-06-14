-- 0007_pickup_origin_and_seq.sql — Leg-0 animation + speakable order numbers
--
-- *** Idempotent — applied on every boot by apply-hand-rolled-migrations.ts ***
-- Every statement uses IF NOT EXISTS so it's a no-op once applied.

-- Leg-0 snapshot: truck's GPS position at the moment of DRIVER_ASSIGNED.
-- Nullable so existing rows stay valid; the frontend hides leg-0 when null.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_origin_geom geography(Point, 4326);

-- Sequence for human-speakable order numbers (#1000, #1001, ...).
-- START 1000 leaves room above any digit-string that might accidentally
-- appear in the legacy #KU-... nanoid format.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000;
