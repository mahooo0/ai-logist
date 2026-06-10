// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/clients/:id/messages — chat history for ADMIN-03.
//
// Phase 4 (Plan 04-03) adds UnifiedMessageSchema per D-23: the route returns
// a UNION over `messages` rows + virtual rows derived from `calls.transcript`
// LATERAL jsonb_array_elements. Each row tells the admin chat which channel
// produced it (telegram vs voice) and carries optional voice metadata
// (callId + timestampMs + audioUrl) for audio playback seek.

import { z } from 'zod/v4';

export const MessageSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  leadId: z.string().uuid().nullable(),
  role: z.enum(['client', 'ai', 'manager']),
  text: z.string(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

// Phase 4 D-23 — UNION response for /api/clients/:id/messages.
// Each row is either a real `messages` row (channel='telegram') OR a virtual
// voice-transcript-turn row (channel='voice'). Voice turns carry callId +
// timestampMs (for audio-player seek) + audioUrl (Twilio recording URL).
// Telegram messages have those set to null.
//
// id is `string` (not uuid) because voice virtual rows use composite ids of
// the form '<call_uuid>:<turn_idx>' to stay deterministic across requests.
export const UnifiedMessageSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  role: z.enum(['client', 'ai', 'manager']),
  text: z.string(),
  channel: z.enum(['telegram', 'voice']),
  callId: z.string().uuid().nullable(),
  timestampMs: z.number().nullable(),
  audioUrl: z.string().nullable(),
});
export type UnifiedMessage = z.infer<typeof UnifiedMessageSchema>;
