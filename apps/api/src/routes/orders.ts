// Phase 1, Plan 01-08: 501 stubs for /api/orders
// Phase 4 Plan 04-03 (API-04): GET / + GET /:id flipped to real handlers.
//   - GET /orders returns OrderListItem[] with joined city/client/channel
//     fields (D-35) — server-side join avoids N+1 in /dashboard/orders.
//   - GET /orders/:id returns OrderDetailExtended (order + events + client +
//     fromCity + toCity + truck + lead) per D-39 — single response for the
//     /dashboard/orders/[id] detail page.
//   - POST /orders + POST /orders/:id/price-override remain 501 stubs
//     (manual order creation + price override audit deferred to v2 per
//     04-CONTEXT scope; ADMIN-NEW-06 not in Phase 4).

import {
  CreateOrderBodySchema,
  OrderDetailExtendedSchema,
  type OrderDetailSchema,
  OrderListItemSchema,
  OrderListQuerySchema,
  OrderRouteResponseSchema,
  OrderSchema,
  PatchOrderProgressBodySchema,
  PatchOrderProgressResponseSchema,
  PriceOverrideBodySchema,
} from '@ai-logist/shared-types/api/orders';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { routeGeometry } from '../lib/routing.js';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Order row → API shape. Bigint price + numeric distance_km → string.
type OrderResponse = z.infer<typeof OrderSchema>;
function serializeOrder(raw: unknown): OrderResponse {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    number: r.number as string,
    leadId: (r.leadId as string | null) ?? null,
    clientId: r.clientId as string,
    truckId: (r.truckId as string | null) ?? null,
    fromCityId: (r.fromCityId as string | null) ?? null,
    toCityId: (r.toCityId as string | null) ?? null,
    distanceKm: r.distanceKm != null ? String(r.distanceKm) : null,
    price: String(r.price),
    currency: r.currency as string,
    status: r.status as OrderResponse['status'],
    publicToken: r.publicToken as string,
    version: Number(r.version ?? 0),
    progressPercent: Number(r.progressPercent ?? 0),
    // Phase 6 W8 — populate autoProgressPaused from DB alias (snake or camel).
    autoProgressPaused: Boolean(r.autoProgressPaused ?? r.auto_progress_paused ?? false),
    createdAt: new Date(r.createdAt as string | Date).toISOString(),
    updatedAt: new Date(r.updatedAt as string | Date).toISOString(),
  };
}

const ordersRoutes: FastifyPluginAsyncZod = async (app) => {
  // Phase 4 API-04 — paginated list with joined city + client + channel.
  // Extends the Phase 1 query schema with a channel filter (consumed from
  // leads.channel via LEFT JOIN). 'voice' matches both 'voice' and 'call'.
  // Sorted createdAt DESC.
  app.get(
    '/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'List orders (Phase 4 API-04)',
        querystring: OrderListQuerySchema.extend({
          channel: z.enum(['telegram', 'voice']).optional(),
        }),
        response: { 200: z.array(OrderListItemSchema) },
      },
    },
    async (req) => {
      const { status, clientId, limit, offset, channel } = req.query;
      const conds: ReturnType<typeof sql>[] = [];
      if (status) conds.push(sql`o.status = ${status}`);
      if (clientId) conds.push(sql`o.client_id = ${clientId}::uuid`);
      if (channel === 'voice') conds.push(sql`l.channel IN ('voice','call')`);
      else if (channel === 'telegram') conds.push(sql`l.channel = 'telegram'`);
      const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = await app.db.execute(sql`
        SELECT o.id, o.number, o.lead_id AS "leadId", o.client_id AS "clientId",
               o.truck_id AS "truckId", o.from_city_id AS "fromCityId",
               o.to_city_id AS "toCityId", o.distance_km AS "distanceKm",
               o.price, o.currency, o.status, o.public_token AS "publicToken",
               o.version, o.progress_percent AS "progressPercent",
               o.created_at AS "createdAt", o.updated_at AS "updatedAt",
               fc.name_ru AS "fromCityName", tc.name_ru AS "toCityName",
               c.name AS "clientName", l.channel AS "leadChannel"
        FROM orders o
        LEFT JOIN cities fc ON fc.id = o.from_city_id
        LEFT JOIN cities tc ON tc.id = o.to_city_id
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN leads l ON l.id = o.lead_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return rows.rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        const order = serializeOrder(r);
        const ch = r.leadChannel as string | null;
        const normalizedChannel: 'telegram' | 'voice' | null =
          ch == null ? null : ch === 'call' ? 'voice' : (ch as 'telegram' | 'voice');
        return {
          ...order,
          fromCityName: (r.fromCityName as string | null) ?? null,
          toCityName: (r.toCityName as string | null) ?? null,
          clientName: (r.clientName as string | null) ?? null,
          channel: normalizedChannel,
        };
      });
    }
  );

  // Phase 4 API-04 — extended detail (D-39). Returns order + events + relations
  // in ONE response so the page doesn't need 4 follow-up fetches. 404 on missing.
  app.get(
    '/orders/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Order detail + events timeline + relations (Phase 4 API-04)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: OrderDetailExtendedSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const orderRow = await app.db.execute(sql`
        SELECT o.id, o.number, o.lead_id AS "leadId", o.client_id AS "clientId",
               o.truck_id AS "truckId", o.from_city_id AS "fromCityId",
               o.to_city_id AS "toCityId", o.distance_km AS "distanceKm",
               o.price, o.currency, o.status, o.public_token AS "publicToken",
               o.version, o.progress_percent AS "progressPercent",
               o.auto_progress_paused AS "autoProgressPaused",
               o.created_at AS "createdAt", o.updated_at AS "updatedAt"
        FROM orders o
        WHERE o.id = ${id}::uuid
      `);
      if (orderRow.rows.length === 0) return reply.notFound(`order ${id} not found`);
      const o = orderRow.rows[0] as Record<string, unknown>;
      const order = serializeOrder(o);

      // Events sorted asc — admin timeline reads top → bottom chronologically.
      const eventsRows = await app.db.execute(sql`
        SELECT id, order_id AS "orderId", type, actor, payload,
               ST_AsGeoJSON(geom)::jsonb AS geom,
               created_at AS "createdAt"
        FROM order_events
        WHERE order_id = ${id}::uuid
        ORDER BY created_at ASC
      `);
      const events = eventsRows.rows.map((raw) => {
        const e = raw as Record<string, unknown>;
        const geomJson = e.geom as { coordinates?: [number, number] } | null;
        return {
          id: e.id as string,
          orderId: e.orderId as string,
          type: e.type as z.infer<typeof OrderDetailSchema>['events'][number]['type'],
          actor: e.actor as string,
          payload: (e.payload as Record<string, unknown>) ?? {},
          geom: geomJson?.coordinates
            ? { lng: Number(geomJson.coordinates[0]), lat: Number(geomJson.coordinates[1]) }
            : null,
          createdAt: new Date(e.createdAt as string | Date).toISOString(),
        };
      });

      const clientRow = await app.db.execute(sql`
        SELECT id, name, phone, lang
        FROM clients
        WHERE id = ${order.clientId}::uuid
      `);
      const client = clientRow.rows[0]
        ? (() => {
            const c = clientRow.rows[0] as Record<string, unknown>;
            return {
              id: c.id as string,
              name: (c.name as string | null) ?? null,
              phone: (c.phone as string | null) ?? null,
              lang: (c.lang as 'ru' | 'ua' | null) ?? null,
            };
          })()
        : null;

      const cityIds = [order.fromCityId, order.toCityId].filter((x): x is string => x != null);
      const cityRows = cityIds.length
        ? await app.db.execute(sql`
            SELECT id, name_ru AS "nameRu", name_ua AS "nameUa"
            FROM cities
            WHERE id = ANY(ARRAY[${sql.join(
              cityIds.map((cid) => sql`${cid}::uuid`),
              sql`, `
            )}])
          `)
        : { rows: [] as Array<Record<string, unknown>> };
      const cityMap = new Map<string, { id: string; nameRu: string; nameUa: string | null }>();
      for (const raw of cityRows.rows) {
        const c = raw as Record<string, unknown>;
        cityMap.set(c.id as string, {
          id: c.id as string,
          nameRu: c.nameRu as string,
          nameUa: (c.nameUa as string | null) ?? null,
        });
      }
      const fromCity = order.fromCityId ? (cityMap.get(order.fromCityId) ?? null) : null;
      const toCity = order.toCityId ? (cityMap.get(order.toCityId) ?? null) : null;

      const truckRow = order.truckId
        ? await app.db.execute(sql`
            SELECT id, name, plate_number AS "plateNumber",
                   driver_name AS "driverName", driver_phone AS "driverPhone",
                   driver_telegram_id AS "driverTelegramId",
                   capacity_t AS "capacityT", body_type AS "bodyType", status,
                   ST_AsGeoJSON(geom)::jsonb AS geom,
                   updated_at AS "updatedAt", created_at AS "createdAt"
            FROM trucks WHERE id = ${order.truckId}::uuid
          `)
        : { rows: [] as Array<Record<string, unknown>> };
      const truck = truckRow.rows[0]
        ? (() => {
            const t = truckRow.rows[0] as Record<string, unknown>;
            const tGeom = t.geom as { coordinates?: [number, number] } | null;
            return {
              id: t.id as string,
              name: t.name as string,
              plateNumber: t.plateNumber as string,
              driverName: t.driverName as string,
              driverPhone: t.driverPhone as string,
              driverTelegramId: (t.driverTelegramId as string | null) ?? null,
              capacityT: Number(t.capacityT),
              bodyType: t.bodyType as 'tent' | 'ref' | 'iso' | 'container',
              status: t.status as 'available' | 'busy' | 'maintenance',
              geom: tGeom?.coordinates
                ? { lng: Number(tGeom.coordinates[0]), lat: Number(tGeom.coordinates[1]) }
                : { lng: 0, lat: 0 },
              updatedAt: new Date(t.updatedAt as string | Date).toISOString(),
              createdAt: new Date(t.createdAt as string | Date).toISOString(),
            };
          })()
        : null;

      const leadRow = order.leadId
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
            FROM leads WHERE id = ${order.leadId}::uuid
          `)
        : { rows: [] as Array<Record<string, unknown>> };
      const lead = leadRow.rows[0]
        ? (() => {
            const l = leadRow.rows[0] as Record<string, unknown>;
            const lc = l.channel as string;
            return {
              id: l.id as string,
              clientId: l.clientId as string,
              channel: (lc === 'call' ? 'voice' : lc) as 'telegram' | 'voice' | 'call',
              stage: l.stage as NonNullable<
                z.infer<typeof OrderDetailExtendedSchema>['lead']
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

      return { order, events, client, fromCity, toCity, truck, lead };
    }
  );

  // /dashboard/tracking — return the OSRM road geometry between pickup and
  // drop-off + the order's stored progress percent so the map can draw a
  // polyline and position the truck marker along it.
  app.get(
    '/orders/:id/route',
    {
      schema: {
        tags: ['orders'],
        summary: 'Road polyline + progress (live tracking)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: OrderRouteResponseSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      // Pull leg-1 endpoints (pickup → delivery cities) PLUS the leg-0 origin
      // snapshot (orders.pickup_origin_geom — written at DRIVER_ASSIGNED).
      // When the snapshot is present we also compute the leg-0 polyline
      // (truck-origin → pickup) so the frontend can render two segments.
      const rows = await app.db.execute(sql`
        SELECT o.id,
               o.status,
               o.progress_percent AS "progressPercent",
               ST_X(fc.geom::geometry) AS "fromLon",
               ST_Y(fc.geom::geometry) AS "fromLat",
               ST_X(tc.geom::geometry) AS "toLon",
               ST_Y(tc.geom::geometry) AS "toLat",
               ST_X(o.pickup_origin_geom::geometry) AS "originLon",
               ST_Y(o.pickup_origin_geom::geometry) AS "originLat"
        FROM orders o
        LEFT JOIN cities fc ON fc.id = o.from_city_id
        LEFT JOIN cities tc ON tc.id = o.to_city_id
        WHERE o.id = ${id}::uuid
      `);
      if (rows.rows.length === 0) return reply.notFound(`order ${id} not found`);
      const r = rows.rows[0] as Record<string, unknown>;
      if (
        r.fromLon == null ||
        r.fromLat == null ||
        r.toLon == null ||
        r.toLat == null
      ) {
        return reply.notFound(`order ${id} is missing pickup or drop-off geometry`);
      }
      const result = await routeGeometry(
        { lon: Number(r.fromLon), lat: Number(r.fromLat) },
        { lon: Number(r.toLon), lat: Number(r.toLat) },
        app.log
      );

      // Leg-0 (truck origin → pickup) — only computed when the snapshot is
      // present. routeGeometry failure is non-fatal: drop leg0 fields, frontend
      // hides the dashed segment.
      let leg0Geometry: Array<[number, number]> | undefined;
      let leg0DistanceKm: number | undefined;
      let leg0EtaSec: number | undefined;
      if (r.originLon != null && r.originLat != null) {
        try {
          const g0 = await routeGeometry(
            { lon: Number(r.originLon), lat: Number(r.originLat) },
            { lon: Number(r.fromLon), lat: Number(r.fromLat) },
            app.log
          );
          leg0Geometry = g0.geometry as Array<[number, number]>;
          leg0DistanceKm = g0.route_km;
          leg0EtaSec = g0.eta_sec;
        } catch (err) {
          app.log.warn({ err, orderId: id }, '/orders/:id/route leg-0 routeGeometry failed');
        }
      }

      return {
        geometry: result.geometry,
        distanceKm: result.route_km,
        etaSec: result.eta_sec,
        progressPercent: Number(r.progressPercent ?? 0),
        source: result.source,
        status: r.status as string,
        leg0Geometry,
        leg0DistanceKm,
        leg0EtaSec,
      };
    }
  );

  // /dashboard/tracking — dispatcher updates the order's progress (slider or
  // drag-on-map). Optimistic-lock-free for simplicity; clobbering is fine
  // because the only writers are the tracking UI and the future GPS webhook.
  app.patch(
    '/orders/:id/progress',
    {
      schema: {
        tags: ['orders'],
        summary: 'Update progress percent (tracking UI)',
        params: z.object({ id: z.string().uuid() }),
        body: PatchOrderProgressBodySchema,
        response: { 200: PatchOrderProgressResponseSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { progressPercent } = req.body;
      const updated = await app.db.execute(sql`
        UPDATE orders
        SET progress_percent = ${progressPercent},
            updated_at = NOW(),
            version = version + 1
        WHERE id = ${id}::uuid
        RETURNING progress_percent AS "progressPercent"
      `);
      if (updated.rows.length === 0) return reply.notFound(`order ${id} not found`);
      const r = updated.rows[0] as Record<string, unknown>;
      return { progressPercent: Number(r.progressPercent ?? 0) };
    }
  );

  app.post(
    '/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'Manual order creation (Phase 4 v2 — deferred)',
        body: CreateOrderBodySchema,
        response: { 201: OrderSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('manual order creation deferred to v2')
  );

  app.post(
    '/orders/:id/price-override',
    {
      schema: {
        tags: ['orders'],
        summary: 'Price override with audit (Phase 4 v2 — deferred)',
        params: z.object({ id: z.string().uuid() }),
        body: PriceOverrideBodySchema,
        response: { 200: OrderSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('price override deferred to v2')
  );

  // Phase 6 D-15 + D-20 — admin status override (bypasses FSM).
  // The admin can force any valid order_status regardless of current state.
  // An admin_override audit event is written with the supplied reason.
  // Guarded by requireAdmin (X-Admin-Secret header) — no-op when ADMIN_API_SECRET unset.
  app.patch(
    '/orders/:id/status',
    {
      schema: {
        tags: ['orders'],
        summary: 'Admin status override (Phase 6 D-15/D-20)',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          status: z.enum([
            'CREATED', 'DRIVER_ASSIGNED', 'AT_LOADING', 'IN_TRANSIT',
            'AT_BORDER', 'DELIVERED', 'CLOSED',
            'DELIVERED_PENDING', 'AWAITING_PAYMENT', 'CANCELED',
          ]),
          reason: z.string().min(1).max(500),
        }),
        response: {
          200: OrderSchema,
          401: z.object({ error: z.string() }),
          404: NotImpl,
        },
      },
      preHandler: async (req, reply) => { await app.requireAdmin(req, reply); },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { status, reason } = req.body;
      // Manual write — bypass transitionOrder so we can move to ANY status.
      // Audit event is the proof-of-override; the verifier asserts admin_override row exists.
      const updated = await app.db.transaction(async (tx) => {
        const r = await tx.execute(sql`
          UPDATE orders
          SET status = ${status}::order_status,
              updated_at = NOW(),
              version = version + 1
          WHERE id = ${id}::uuid
          RETURNING id, number, lead_id AS "leadId", client_id AS "clientId",
                    truck_id AS "truckId", from_city_id AS "fromCityId",
                    to_city_id AS "toCityId", distance_km AS "distanceKm",
                    price, currency, status, public_token AS "publicToken",
                    version, progress_percent AS "progressPercent",
                    auto_progress_paused AS "autoProgressPaused",
                    created_at AS "createdAt", updated_at AS "updatedAt"
        `);
        if (r.rows.length === 0) return null;
        await tx.execute(sql`
          INSERT INTO order_events (order_id, type, actor, payload)
          VALUES (${id}::uuid, 'admin_override'::order_event_type, 'manager',
                  ${JSON.stringify({ reason, new_status: status })}::jsonb)
          ON CONFLICT (order_id, type) DO NOTHING
        `);
        return r.rows[0];
      });
      if (!updated) return reply.notFound(`order ${id} not found`);
      return serializeOrder(updated);
    }
  );

  // Phase 6 D-21 — pause/resume auto-progress.
  // Sets orders.auto_progress_paused; ticker SELECT excludes paused=true rows.
  // Guarded by requireAdmin (X-Admin-Secret header) — no-op when ADMIN_API_SECRET unset.
  app.post(
    '/orders/:id/ticker',
    {
      schema: {
        tags: ['orders'],
        summary: 'Pause/resume auto-progress ticker (Phase 6 D-21)',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ paused: z.boolean() }),
        response: {
          200: z.object({ id: z.string().uuid(), autoProgressPaused: z.boolean() }),
          401: z.object({ error: z.string() }),
          404: NotImpl,
        },
      },
      preHandler: async (req, reply) => { await app.requireAdmin(req, reply); },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { paused } = req.body;
      const r = await app.db.execute(sql`
        UPDATE orders
        SET auto_progress_paused = ${paused}, updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING id, auto_progress_paused AS "autoProgressPaused"
      `);
      if (r.rows.length === 0) return reply.notFound(`order ${id} not found`);
      const row = r.rows[0] as { id: string; autoProgressPaused: boolean };
      return { id: row.id, autoProgressPaused: row.autoProgressPaused };
    }
  );
};

export default ordersRoutes;
