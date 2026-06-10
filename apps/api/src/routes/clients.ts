// Phase 1, Plan 01-08: 501 stub for /api/clients/:id/messages
// Phase 4 Plan 04-03 (API-06): flipped to real UNION ALL handler — RESEARCH
// Pattern 4 + Example 3.
//
// The handler returns a chronologically-merged feed of:
//   1. real `messages` rows for the client (channel='telegram', callId=null),
//   2. virtual rows derived from `calls.transcript` via LATERAL
//      jsonb_array_elements WITH ORDINALITY (channel='voice', callId set,
//      timestamp_ms either from the turn payload OR a defensive idx-based
//      fallback so voice rows are still well-ordered when the upstream is
//      missing per-turn timestamps).
//
// The call → client linkage is "calls linked to ANY lead owned by this client",
// covering both linked_lead_id (Phase 3.1) and legacy lead_id.

import { ListMessagesQuerySchema, UnifiedMessageSchema } from '@ai-logist/shared-types/api/clients';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const clientsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/clients/:id/messages',
    {
      schema: {
        tags: ['clients'],
        summary: 'Client message history — telegram + voice transcript UNION (Phase 4 API-06)',
        params: z.object({ id: z.string().uuid() }),
        querystring: ListMessagesQuerySchema,
        response: { 200: z.array(UnifiedMessageSchema), 400: NotImpl },
      },
    },
    async (req) => {
      const { id } = req.params;
      const { limit, offset } = req.query;

      // Defensive timestamp computation in the voice CTE: when the turn payload
      // omits `timestamp_ms`, fall back to (idx - 1) * 1000 ms — keeps voice
      // rows monotonically ordered without requiring ElevenLabs to emit the
      // exact field on every turn (RESEARCH Pattern 4 footnote).
      const result = await app.db.execute(sql`
        WITH msgs AS (
          SELECT
            m.id::text                AS id,
            m.created_at              AS created_at,
            m.role                    AS role,
            m.text                    AS text,
            'telegram'::text          AS channel,
            NULL::uuid                AS call_id,
            NULL::bigint              AS timestamp_ms,
            NULL::text                AS audio_url
          FROM messages m
          WHERE m.client_id = ${id}::uuid
        ),
        voice AS (
          SELECT
            c.id::text || ':' || idx::text                                       AS id,
            c.created_at + (
              COALESCE(NULLIF(turn->>'timestamp_ms','')::bigint, (idx::bigint - 1) * 1000)
              * INTERVAL '1 ms'
            )                                                                     AS created_at,
            CASE WHEN turn->>'speaker' = 'agent' THEN 'ai' ELSE 'client' END     AS role,
            COALESCE(turn->>'text', '')                                          AS text,
            'voice'::text                                                        AS channel,
            c.id                                                                 AS call_id,
            COALESCE(NULLIF(turn->>'timestamp_ms','')::bigint, (idx::bigint - 1) * 1000) AS timestamp_ms,
            c.audio_url                                                          AS audio_url
          FROM calls c,
               LATERAL jsonb_array_elements(c.transcript) WITH ORDINALITY AS t(turn, idx)
          WHERE EXISTS (
            SELECT 1 FROM leads l
            WHERE (l.id = c.linked_lead_id OR l.id = c.lead_id)
              AND l.client_id = ${id}::uuid
          )
        )
        SELECT * FROM msgs
        UNION ALL
        SELECT * FROM voice
        ORDER BY created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          id: r.id as string,
          createdAt: new Date(r.created_at as string | Date).toISOString(),
          role: r.role as 'client' | 'ai' | 'manager',
          text: (r.text as string) ?? '',
          channel: r.channel as 'telegram' | 'voice',
          callId: (r.call_id as string | null) ?? null,
          timestampMs: r.timestamp_ms != null ? Number(r.timestamp_ms) : null,
          audioUrl: (r.audio_url as string | null) ?? null,
        };
      });
    }
  );
};

export default clientsRoutes;
