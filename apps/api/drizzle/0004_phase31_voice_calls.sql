-- apps/api/drizzle/0004_phase31_voice_calls.sql
-- Phase 3.1 — extends calls table with voice-channel fields + introduces call_outcome enum.
-- Idempotent (IF NOT EXISTS guards + DO $$ duplicate_object catch). Aligned with CONTEXT D-13.

-- 1. New enum for call outcomes
DO $$ BEGIN
  CREATE TYPE call_outcome AS ENUM ('completed', 'abandoned', 'escalated', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend calls with voice-specific columns
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS audio_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS lang client_lang NULL,
  ADD COLUMN IF NOT EXISTS linked_lead_id UUID NULL REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_price_at_confirmation BIGINT NULL,
  ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT NULL;

-- 3. Replace existing `outcome TEXT` with typed enum (Phase 1 guarantees calls table empty).
-- The empty-table guard protects against running this migration on a non-empty calls table
-- where the legacy text values would be lost without manual review.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM calls LIMIT 1) THEN
    RAISE EXCEPTION 'calls table is not empty — manual outcome migration required';
  END IF;
END $$;

ALTER TABLE calls DROP COLUMN IF EXISTS outcome;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome call_outcome NULL;

-- 4. transcript already exists from Phase 1; ensure default is jsonb '[]' and NOT NULL
ALTER TABLE calls ALTER COLUMN transcript SET DEFAULT '[]'::jsonb;
ALTER TABLE calls ALTER COLUMN transcript SET NOT NULL;

-- 5. UNIQUE indexes on the two external IDs (D-13)
CREATE UNIQUE INDEX IF NOT EXISTS calls_elevenlabs_conversation_id_uq
  ON calls(elevenlabs_conversation_id)
  WHERE elevenlabs_conversation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS calls_twilio_call_sid_uq
  ON calls(twilio_call_sid)
  WHERE twilio_call_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS calls_outcome_idx ON calls(outcome);
CREATE INDEX IF NOT EXISTS calls_lang_idx ON calls(lang);
CREATE INDEX IF NOT EXISTS calls_linked_lead_idx ON calls(linked_lead_id);
