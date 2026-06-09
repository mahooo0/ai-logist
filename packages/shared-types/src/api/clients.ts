// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/clients/:id/messages — chat history for ADMIN-03.

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
