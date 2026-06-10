ALTER TABLE "leads" ADD COLUMN "manager_active" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
--> phase 3: partial index for driver_telegram_id lookups (notifyDriver path)
CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx
  ON trucks (driver_telegram_id)
  WHERE driver_telegram_id IS NOT NULL;
