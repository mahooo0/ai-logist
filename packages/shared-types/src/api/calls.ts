// @ai-logist/shared-types — Phase 4, Plan 04-03
// DTO schemas for /api/calls — D-19 + D-31 + D-62.
//
// Phase 4 adds the /api/calls endpoint family for the admin web `/dashboard/calls`
// page. CallSchema mirrors the post-Phase 3.1 calls row (D-13 schema extensions).
// Transcript turns are modelled loosely (passthrough unknown fields) because
// ElevenLabs payloads may drift; defensive coercion happens at the SQL/handler
// boundary, not in the schema.

import { z } from 'zod/v4';
import { LeadSchema } from './leads.js';
import { OrderSchema } from './orders.js';

const CallOutcome = z.enum(['completed', 'abandoned', 'escalated', 'error']);
const CallLang = z.enum(['ru', 'ua']);

// Transcript turn shape (Phase 3.1 D-13 + RESEARCH Pattern 4):
//   { speaker: 'agent' | 'caller', text: string, timestamp_ms: number }
// .loose() (zod/v4 rename of .passthrough()) lets unknown keys through —
// ElevenLabs may add fields we don't surface in the admin UI.
export const TranscriptTurnSchema = z
  .object({
    speaker: z.enum(['agent', 'caller']).optional(),
    text: z.string().optional(),
    timestamp_ms: z.number().int().nullable().optional(),
  })
  .loose();
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const CallSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid().nullable(),
  linkedLeadId: z.string().uuid().nullable(),
  direction: z.enum(['inbound', 'outbound']),
  durationS: z.number().int().nullable(),
  outcome: CallOutcome.nullable(),
  lang: CallLang.nullable(),
  audioUrl: z.string().nullable(), // accept any string (file:// + relative paths during demo)
  recordingUrl: z.string().nullable(), // Phase 1 legacy column
  quotedPriceAtConfirmation: z.string().nullable(), // bigint → string for precision
  elevenlabsConversationId: z.string().nullable(),
  twilioCallSid: z.string().nullable(),
  transcript: z.array(TranscriptTurnSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Call = z.infer<typeof CallSchema>;

export const CallDetailSchema = z.object({
  call: CallSchema,
  linkedLead: LeadSchema.nullable(),
  linkedOrder: OrderSchema.nullable(),
});
export type CallDetail = z.infer<typeof CallDetailSchema>;

export const CallListQuerySchema = z.object({
  outcome: CallOutcome.optional(),
  lang: CallLang.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CallListQuery = z.infer<typeof CallListQuerySchema>;
