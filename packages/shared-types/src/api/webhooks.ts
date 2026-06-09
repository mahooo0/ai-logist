// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /webhook/* — Telegram updates, voice callbacks, GPS pushes.
//
// Coarse validation here — Telegram + voice payloads are large/variable and the spec
// only requires us to key on update_id / call_id for idempotency (D-09).
// Phase 3 (Telegram) and Phase 5 (GPS) will tighten if needed.

import { z } from 'zod/v4';

// Telegram Update — accept any shape so future bot API changes don't reject;
// key on update_id (DB-09 idempotency)
export const TelegramUpdateBodySchema = z
  .object({
    update_id: z.number().int(),
  })
  .passthrough();
export type TelegramUpdateBody = z.infer<typeof TelegramUpdateBodySchema>;

export const GpsPushBodySchema = z.object({
  truckId: z.string().uuid(),
  lng: z.number(),
  lat: z.number(),
  recordedAt: z.string().datetime(),
});
export type GpsPushBody = z.infer<typeof GpsPushBodySchema>;

export const VoiceCallbackBodySchema = z
  .object({
    call_id: z.string(),
    event: z.string(),
  })
  .passthrough();
export type VoiceCallbackBody = z.infer<typeof VoiceCallbackBodySchema>;

export const WebhookAckResponseSchema = z.object({
  ok: z.boolean(),
});
export type WebhookAckResponse = z.infer<typeof WebhookAckResponseSchema>;
