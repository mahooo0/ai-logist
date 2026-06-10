// Phase 4 Plan 04-03 — NEW route family for /api/calls (ADMIN-NEW-08 + D-31).
//
// GET /api/calls — paginated list with outcome/lang/from/to filters; sorted
//   created_at DESC. Backs the /dashboard/calls table.
// GET /api/calls/:id — call + linkedLead + linkedOrder; 404 on missing.
//   Backs the /dashboard/calls/[id] modal (audio playback + transcript seek).

import {
  CallDetailSchema,
  CallListQuerySchema,
  CallSchema,
} from '@ai-logist/shared-types/api/calls';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Serialise a calls row into CallSchema shape.
// - Bigint quoted_price_at_confirmation → string for JSON precision.
// - transcript jsonb defaulted to [] if NULL or not-an-array (defensive).
// - createdAt → ISO string (consistent with other routes).
type CallResponse = z.infer<typeof CallSchema>;
function serializeCallRow(raw: unknown): CallResponse {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    leadId: (r.leadId as string | null) ?? null,
    linkedLeadId: (r.linkedLeadId as string | null) ?? null,
    direction: r.direction as CallResponse['direction'],
    durationS: r.durationS != null ? Number(r.durationS) : null,
    outcome: (r.outcome as CallResponse['outcome']) ?? null,
    lang: (r.lang as CallResponse['lang']) ?? null,
    audioUrl: (r.audioUrl as string | null) ?? null,
    recordingUrl: (r.recordingUrl as string | null) ?? null,
    quotedPriceAtConfirmation:
      r.quotedPriceAtConfirmation != null ? String(r.quotedPriceAtConfirmation) : null,
    elevenlabsConversationId: (r.elevenlabsConversationId as string | null) ?? null,
    twilioCallSid: (r.twilioCallSid as string | null) ?? null,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    createdAt: new Date(r.createdAt as string | Date).toISOString(),
  };
}

const callsRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/calls — paginated list with optional filters.
  app.get(
    '/calls',
    {
      schema: {
        tags: ['calls'],
        summary: 'List calls (Phase 4 ADMIN-NEW-08)',
        querystring: CallListQuerySchema,
        response: { 200: z.array(CallSchema) },
      },
    },
    async (req) => {
      const { outcome, lang, from, to, limit, offset } = req.query;
      const conds: ReturnType<typeof sql>[] = [];
      if (outcome) conds.push(sql`outcome = ${outcome}`);
      if (lang) conds.push(sql`lang = ${lang}`);
      if (from) conds.push(sql`created_at >= ${from}::timestamptz`);
      if (to) conds.push(sql`created_at <= ${to}::timestamptz`);
      const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = await app.db.execute(sql`
        SELECT id,
               lead_id AS "leadId",
               linked_lead_id AS "linkedLeadId",
               direction,
               duration_s AS "durationS",
               outcome,
               lang,
               audio_url AS "audioUrl",
               recording_url AS "recordingUrl",
               quoted_price_at_confirmation AS "quotedPriceAtConfirmation",
               elevenlabs_conversation_id AS "elevenlabsConversationId",
               twilio_call_sid AS "twilioCallSid",
               transcript,
               created_at AS "createdAt"
        FROM calls
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return rows.rows.map(serializeCallRow);
    }
  );

  // GET /api/calls/:id — call detail with linkedLead + linkedOrder. The JOIN
  // matches calls.linked_lead_id first, falling back to calls.lead_id.
  // linkedOrder is the order anchored to that lead (lead.order_id), if any.
  // 404 on missing call.
  app.get(
    '/calls/:id',
    {
      schema: {
        tags: ['calls'],
        summary: 'Call detail + linked lead + linked order (Phase 4 ADMIN-NEW-08)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: CallDetailSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const callRow = await app.db.execute(sql`
        SELECT id,
               lead_id AS "leadId",
               linked_lead_id AS "linkedLeadId",
               direction,
               duration_s AS "durationS",
               outcome,
               lang,
               audio_url AS "audioUrl",
               recording_url AS "recordingUrl",
               quoted_price_at_confirmation AS "quotedPriceAtConfirmation",
               elevenlabs_conversation_id AS "elevenlabsConversationId",
               twilio_call_sid AS "twilioCallSid",
               transcript,
               created_at AS "createdAt"
        FROM calls
        WHERE id = ${id}::uuid
      `);
      if (callRow.rows.length === 0) return reply.notFound(`call ${id} not found`);
      const call = serializeCallRow(callRow.rows[0]);

      // Linked lead: linked_lead_id wins; fallback to legacy lead_id.
      const leadId = call.linkedLeadId ?? call.leadId;
      const leadRow = leadId
        ? await app.db.execute(sql`
            SELECT id, client_id AS "clientId", channel, stage,
                   from_city_id AS "fromCityId", to_city_id AS "toCityId",
                   tons, body_type AS "bodyType", budget,
                   volume_m3 AS "volumeM3", dimensions_lxwxh AS "dimensionsLxwxh",
                   packaging, adr_class AS "adrClass", declared_value AS "declaredValue",
                   matched_truck_id AS "matchedTruckId", quoted_price AS "quotedPrice",
                   order_id AS "orderId",
                   manager_active AS "managerActive",
                   COALESCE(price_overrides, '{}'::jsonb[]) AS "priceOverrides",
                   version, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM leads WHERE id = ${leadId}::uuid
          `)
        : { rows: [] as Array<Record<string, unknown>> };
      const linkedLead = leadRow.rows[0]
        ? (() => {
            const l = leadRow.rows[0] as Record<string, unknown>;
            const lc = l.channel as string;
            return {
              id: l.id as string,
              clientId: l.clientId as string,
              channel: (lc === 'call' ? 'voice' : lc) as 'telegram' | 'voice' | 'call',
              stage: l.stage as NonNullable<
                z.infer<typeof CallDetailSchema>['linkedLead']
              >['stage'],
              fromCityId: (l.fromCityId as string | null) ?? null,
              toCityId: (l.toCityId as string | null) ?? null,
              tons: l.tons != null ? String(l.tons) : null,
              bodyType: (l.bodyType as 'tent' | 'ref' | 'iso' | 'container' | null) ?? null,
              budget: l.budget != null ? String(l.budget) : null,
              volumeM3: l.volumeM3 != null ? String(l.volumeM3) : null,
              dimensionsLxwxh: (l.dimensionsLxwxh as string | null) ?? null,
              packaging: (l.packaging as string | null) ?? null,
              adrClass: (l.adrClass as string | null) ?? null,
              declaredValue: l.declaredValue != null ? String(l.declaredValue) : null,
              matchedTruckId: (l.matchedTruckId as string | null) ?? null,
              quotedPrice: l.quotedPrice != null ? String(l.quotedPrice) : null,
              orderId: (l.orderId as string | null) ?? null,
              managerActive: Boolean(l.managerActive ?? false),
              priceOverrides: Array.isArray(l.priceOverrides) ? l.priceOverrides : [],
              version: Number(l.version ?? 0),
              createdAt: new Date(l.createdAt as string | Date).toISOString(),
              updatedAt: new Date(l.updatedAt as string | Date).toISOString(),
            };
          })()
        : null;

      const orderId = linkedLead?.orderId ?? null;
      const orderRow = orderId
        ? await app.db.execute(sql`
            SELECT id, number, lead_id AS "leadId", client_id AS "clientId",
                   truck_id AS "truckId", from_city_id AS "fromCityId",
                   to_city_id AS "toCityId", distance_km AS "distanceKm",
                   price, currency, status, public_token AS "publicToken",
                   version, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM orders WHERE id = ${orderId}::uuid
          `)
        : { rows: [] as Array<Record<string, unknown>> };
      const linkedOrder = orderRow.rows[0]
        ? (() => {
            const o = orderRow.rows[0] as Record<string, unknown>;
            return {
              id: o.id as string,
              number: o.number as string,
              leadId: (o.leadId as string | null) ?? null,
              clientId: o.clientId as string,
              truckId: (o.truckId as string | null) ?? null,
              fromCityId: (o.fromCityId as string | null) ?? null,
              toCityId: (o.toCityId as string | null) ?? null,
              distanceKm: o.distanceKm != null ? String(o.distanceKm) : null,
              price: String(o.price),
              currency: o.currency as string,
              status: o.status as NonNullable<
                z.infer<typeof CallDetailSchema>['linkedOrder']
              >['status'],
              publicToken: o.publicToken as string,
              version: Number(o.version ?? 0),
              createdAt: new Date(o.createdAt as string | Date).toISOString(),
              updatedAt: new Date(o.updatedAt as string | Date).toISOString(),
            };
          })()
        : null;

      return { call, linkedLead, linkedOrder };
    }
  );
};

export default callsRoutes;
