// Phase 1, Plan 01-08: 501 stubs for /api/leads
// Phase 2, Plan 02-05: real handlers for POST /:id/match + /:id/quote (API-07).
//
// GET /leads + PATCH /leads/:id remain 501 stubs (Phase 4 admin Kanban).
// POST /leads/:id/match — manager-triggered re-match: nearestTruck + (optional)
//   transitionLead → MATCHED (when source stage is QUALIFIED).
// POST /leads/:id/quote — manager-triggered re-price: calcPrice + PRICE-LOCK
//   (write leads.quoted_price BEFORE returning) + (optional) transitionLead →
//   QUOTED.
//
// Both routes invoke the SAME functions as the intake pipeline (nearestTruck,
// calcPrice, transitionLead) — single source of truth for matching/pricing.
//
// Error handling:
//   - 404 lead not found
//   - 400 missing pre-conditions (no pickup city, no tonnage, no destination)
//   - 409 ONLY on true VersionMismatch (concurrent write race)
//   - IllegalTransition during re-run = lead already past target stage —
//     log, swallow, return current trucks/price. Re-match/re-quote is
//     idempotent from the caller's perspective.

import {
  LeadInterceptResponseSchema,
  LeadListQuerySchema,
  LeadMatchResponseSchema,
  LeadPatchBodySchema,
  LeadQuoteResponseSchema,
  LeadReleaseResponseSchema,
  LeadSchema,
  ManagerMessageBodySchema,
  ManagerMessageResponseSchema,
} from '@ai-logist/shared-types/api/leads';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { routeKm } from '../lib/routing.js';
import { clientsRepo, leadsRepo, messagesRepo } from '../persistence/repos/index.js';
import { IllegalTransition, VersionMismatch } from '../pipeline/lifecycle/errors.js';
import { transitionLead } from '../pipeline/lifecycle/lead-fsm.js';
import { calcPrice, readPricingConfig } from '../pipeline/llm-tools/calc-price.js';
import { nearestTruck } from '../pipeline/llm-tools/nearest-truck.js';

// Canonical shape @fastify/sensible writes for reply.notImplemented() / other
// error helpers. Also used as the response envelope for 400/404/409.
const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Phase 4 API-03 — typed serialiser for a Lead row (handler returns Lead-shaped
// objects). Coerces legacy 'call' channel → 'voice' (Open Question #4),
// stringifies bigint kopecks (budget/declaredValue/quotedPrice), and
// normalises priceOverrides + timestamps.
type LeadResponse = z.infer<typeof LeadSchema>;
function serializeLeadRow(raw: unknown): LeadResponse {
  const r = raw as Record<string, unknown>;
  const channelRaw = r.channel as string;
  return {
    id: r.id as string,
    clientId: r.clientId as string,
    channel: (channelRaw === 'call' ? 'voice' : channelRaw) as LeadResponse['channel'],
    stage: r.stage as LeadResponse['stage'],
    fromCityId: (r.fromCityId as string | null) ?? null,
    toCityId: (r.toCityId as string | null) ?? null,
    tons: r.tons != null ? String(r.tons) : null,
    bodyType: (r.bodyType as LeadResponse['bodyType']) ?? null,
    budget: r.budget != null ? String(r.budget) : null,
    volumeM3: r.volumeM3 != null ? String(r.volumeM3) : null,
    dimensionsLxwxh: (r.dimensionsLxwxh as string | null) ?? null,
    packaging: (r.packaging as string | null) ?? null,
    adrClass: (r.adrClass as string | null) ?? null,
    declaredValue: r.declaredValue != null ? String(r.declaredValue) : null,
    matchedTruckId: (r.matchedTruckId as string | null) ?? null,
    quotedPrice: r.quotedPrice != null ? String(r.quotedPrice) : null,
    orderId: (r.orderId as string | null) ?? null,
    priceOverrides: Array.isArray(r.priceOverrides) ? r.priceOverrides : [],
    version: Number(r.version ?? 0),
    createdAt: new Date(r.createdAt as string | Date).toISOString(),
    updatedAt: new Date(r.updatedAt as string | Date).toISOString(),
  };
}

const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Phase 4 API-03 — list leads filtered by stage + channel (D-60).
  // - channel='voice' matches both 'voice' and legacy 'call' rows; the
  //   response coerces 'call' → 'voice' so admin only sees 2 stable values.
  // - Sorted createdAt DESC; pagination via limit/offset query.
  app.get(
    '/leads',
    {
      schema: {
        tags: ['leads'],
        summary: 'List leads (Phase 4 API-03)',
        querystring: LeadListQuerySchema,
        response: { 200: z.array(LeadSchema), 400: NotImpl },
      },
    },
    async (req) => {
      const { stage, clientId, channel, limit, offset } = req.query;
      const conds: ReturnType<typeof sql>[] = [];
      if (stage) conds.push(sql`stage = ${stage}`);
      if (clientId) conds.push(sql`client_id = ${clientId}::uuid`);
      if (channel) {
        if (channel === 'voice') {
          conds.push(sql`channel IN ('voice','call')`);
        } else {
          conds.push(sql`channel = ${channel}`);
        }
      }
      const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = await app.db.execute(sql`
        SELECT id, client_id AS "clientId", channel, stage,
               from_city_id AS "fromCityId", to_city_id AS "toCityId",
               tons, body_type AS "bodyType", budget,
               volume_m3 AS "volumeM3", dimensions_lxwxh AS "dimensionsLxwxh",
               packaging, adr_class AS "adrClass", declared_value AS "declaredValue",
               matched_truck_id AS "matchedTruckId", quoted_price AS "quotedPrice",
               order_id AS "orderId",
               COALESCE(price_overrides, '{}'::jsonb[]) AS "priceOverrides",
               version, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM leads
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return rows.rows.map((raw) => serializeLeadRow(raw));
    }
  );

  // Phase 4 API-03 (supporting ADMIN-NEW-02) — manager edits lead.stage.
  // Bare-minimum: optimistic version check + UPDATE; full Kanban DnD UX is v2.
  // 404 if missing; 409 on version mismatch.
  app.patch(
    '/leads/:id',
    {
      schema: {
        tags: ['leads'],
        summary: 'Update lead stage (Phase 4 API-03)',
        params: z.object({ id: z.string().uuid() }),
        body: LeadPatchBodySchema,
        response: { 200: LeadSchema, 404: NotImpl, 409: NotImpl, 400: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { stage, version } = req.body;
      if (!stage) return reply.badRequest('stage is required (Phase 4 PATCH minimum)');
      const result = await app.db.execute(sql`
        UPDATE leads
        SET stage = ${stage}, version = version + 1, updated_at = NOW()
        WHERE id = ${id}::uuid AND version = ${version}
        RETURNING id, client_id AS "clientId", channel, stage,
                  from_city_id AS "fromCityId", to_city_id AS "toCityId",
                  tons, body_type AS "bodyType", budget,
                  volume_m3 AS "volumeM3", dimensions_lxwxh AS "dimensionsLxwxh",
                  packaging, adr_class AS "adrClass", declared_value AS "declaredValue",
                  matched_truck_id AS "matchedTruckId", quoted_price AS "quotedPrice",
                  order_id AS "orderId",
                  COALESCE(price_overrides, '{}'::jsonb[]) AS "priceOverrides",
                  version, created_at AS "createdAt", updated_at AS "updatedAt"
      `);
      if (result.rows.length === 0) {
        const exists = await app.db.execute(sql`SELECT 1 FROM leads WHERE id = ${id}::uuid`);
        if (exists.rows.length === 0) return reply.notFound(`lead ${id} not found`);
        return reply.conflict('version mismatch');
      }
      return serializeLeadRow(result.rows[0]);
    }
  );

  // POST /api/leads/:id/match — Phase 2 API-07.
  //
  // 1. Load lead via leadsRepo.findById; 404 if missing.
  // 2. Require lead.fromCityId AND lead.tons > 0.
  // 3. Read pickup lon/lat from cities table.
  // 4. Call nearestTruck (same CTE re-rank as the pipeline).
  // 5. If trucks.length > 0 AND lead.stage === 'QUALIFIED' →
  //    transitionLead → MATCHED. IllegalTransition / VersionMismatch on the
  //    transition is swallowed (re-match is idempotent past MATCHED).
  // 6. Return 200 { lead_id, trucks }.
  app.post(
    '/leads/:id/match',
    {
      schema: {
        tags: ['leads'],
        summary: 'Re-run truck matching (Phase 2)',
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: LeadMatchResponseSchema,
          400: NotImpl,
          404: NotImpl,
          409: NotImpl,
        },
      },
    },
    async (req, reply) => {
      const lead = await leadsRepo.findById(app.db, req.params.id);
      if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
      if (!lead.fromCityId) return reply.badRequest('lead has no pickup city');

      const tons = Number(lead.tons ?? 0);
      if (!Number.isFinite(tons) || tons <= 0) {
        return reply.badRequest('lead has no tonnage');
      }

      // Pickup lon/lat — geography stored as WKB; ST_X/ST_Y on the geometry
      // cast extracts the coordinates.
      const cityRow = await app.db.execute(sql`
        SELECT ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat
        FROM cities WHERE id = ${lead.fromCityId}
      `);
      const city = cityRow.rows[0] as { lon: number | string; lat: number | string } | undefined;
      if (!city) return reply.badRequest('pickup city geom missing');

      const pickupLon = Number(city.lon);
      const pickupLat = Number(city.lat);
      if (!Number.isFinite(pickupLon) || !Number.isFinite(pickupLat)) {
        return reply.badRequest('pickup city geom invalid');
      }

      const trucks = await nearestTruck(app.db, {
        pickupLon,
        pickupLat,
        tons,
        bodyType: lead.bodyType,
      });

      // Only promote NEW → QUALIFIED → MATCHED when the lead is QUALIFIED.
      // The pipeline already moves NEW → QUALIFIED on extraction; if the route
      // is hit on a NEW lead the manager needs to qualify it first via PATCH.
      if (trucks.length > 0 && lead.stage === 'QUALIFIED') {
        try {
          await transitionLead(app.db, {
            leadId: lead.id,
            to: 'MATCHED',
            actor: 'manager',
            payload: { re_match: true, count: trucks.length },
          });
        } catch (err) {
          if (err instanceof IllegalTransition || err instanceof VersionMismatch) {
            app.log.warn(
              { err, leadId: lead.id },
              'match: transition skipped (already past MATCHED or version race)'
            );
            // Re-match is idempotent; return trucks anyway.
          } else {
            throw err;
          }
        }
      }

      return reply.code(200).send({
        lead_id: lead.id,
        trucks: trucks.map((t) => ({
          id: t.id,
          driver_phone: t.driver_phone,
          plate_number: t.plate_number,
          capacity_t: t.capacity_t,
          body_type: t.body_type,
          meters: t.meters,
          source: t.source,
        })),
      });
    }
  );

  // POST /api/leads/:id/quote — Phase 2 API-07 (price-lock protocol applies).
  //
  // 1. Load lead. 404 if missing.
  // 2. Require lead.fromCityId AND lead.toCityId AND lead.tons > 0.
  // 3. Read both cities' lon/lat.
  // 4. routeKm via OSRM (haversine fallback) — same code path as intake.ts.
  // 5. cfg = readPricingConfig; priceOut = calcPrice(...).
  // 6. PRICE-LOCK: leadsRepo.update({quotedPrice: priceOut.default}) BEFORE
  //    sending the response — the lead row reflects the quote even if the
  //    caller disconnects mid-response (Pitfall #1, MATCH-06 / D-25).
  // 7. transitionLead → QUOTED. Swallow IllegalTransition (already past QUOTED
  //    is fine — quoted_price is already updated). Return 409 on VersionMismatch.
  // 8. Return 200 with quoted_price_kopecks + corridor.
  app.post(
    '/leads/:id/quote',
    {
      schema: {
        tags: ['leads'],
        summary: 'Re-run price calculation (Phase 2)',
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: LeadQuoteResponseSchema,
          400: NotImpl,
          404: NotImpl,
          409: NotImpl,
        },
      },
    },
    async (req, reply) => {
      const lead = await leadsRepo.findById(app.db, req.params.id);
      if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
      if (!lead.fromCityId || !lead.toCityId) {
        return reply.badRequest('lead missing from_city or to_city');
      }
      const tons = Number(lead.tons ?? 0);
      if (!Number.isFinite(tons) || tons <= 0) {
        return reply.badRequest('lead has no tonnage');
      }

      const cityRows = await app.db.execute(sql`
        SELECT id::text AS id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat
        FROM cities WHERE id IN (${lead.fromCityId}, ${lead.toCityId})
      `);
      const cityMap = new Map<string, { lon: number; lat: number }>();
      for (const r of cityRows.rows as Array<{
        id: string;
        lon: number | string;
        lat: number | string;
      }>) {
        cityMap.set(r.id, { lon: Number(r.lon), lat: Number(r.lat) });
      }
      const from = cityMap.get(lead.fromCityId);
      const to = cityMap.get(lead.toCityId);
      if (!from || !to) return reply.badRequest('city geom missing');

      const { route_km } = await routeKm(from, to, app.log);
      const cfg = await readPricingConfig(app.db);
      const priceOut = calcPrice(
        {
          route_km,
          tons,
          bodyType: lead.bodyType ?? 'tent',
          date: new Date(),
          direction: 'default',
        },
        cfg
      );

      // PRICE-LOCK: write to DB BEFORE responding (D-25, MATCH-06). This is the
      // same invariant intake.ts enforces in Step I — the route handler shares
      // the surface with the pipeline.
      await leadsRepo.update(app.db, lead.id, { quotedPrice: priceOut.default });

      let stage: string = lead.stage;
      try {
        await transitionLead(app.db, {
          leadId: lead.id,
          to: 'QUOTED',
          actor: 'manager',
          payload: {
            quoted_price: priceOut.default.toString(),
            min: priceOut.min.toString(),
            max: priceOut.max.toString(),
            route_km,
            re_quote: true,
          },
        });
        stage = 'QUOTED';
      } catch (err) {
        if (err instanceof IllegalTransition) {
          app.log.warn(
            { err, leadId: lead.id },
            'quote: illegal transition (stage already past QUOTED?)'
          );
          // Don't fail — quoted_price is already updated; the caller may be
          // re-quoting an AGREED lead. Surface the current stage.
        } else if (err instanceof VersionMismatch) {
          return reply.conflict(`concurrent update on lead ${lead.id} — retry`);
        } else {
          throw err;
        }
      }

      return reply.code(200).send({
        lead_id: lead.id,
        quoted_price_kopecks: priceOut.default.toString(),
        min_kopecks: priceOut.min.toString(),
        max_kopecks: priceOut.max.toString(),
        route_km,
        stage,
      });
    }
  );

  // Phase 3 Plan 03-05 TG-06 — Manager takes over the conversation.
  //
  // Flips leads.manager_active=true; subsequent Telegram inbound from this
  // client is persisted with role='client' but intake is bypassed (adapter
  // gate). Best-effort delivers the localized welcome via the Telegram bot AND
  // persists the welcome with role='manager' so the admin timeline shows it.
  // Bot send failures are logged + swallowed — the flag flip is the contract.
  app.post(
    '/leads/:id/intercept',
    {
      schema: {
        tags: ['leads'],
        summary: 'Manager intercept (Phase 3 TG-06)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: LeadInterceptResponseSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const lead = await leadsRepo.findById(app.db, req.params.id);
      if (!lead) return reply.notFound(`lead ${req.params.id} not found`);

      await app.db.execute(sql`
        UPDATE leads SET manager_active = true, updated_at = NOW()
        WHERE id = ${lead.id}
      `);

      const client = await clientsRepo.findById(app.db, lead.clientId);
      if (client?.telegramId) {
        const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
        const welcome =
          lang === 'ua'
            ? 'Доброго дня, я Іван, менеджер. Чим можу допомогти?'
            : 'Здравствуйте, я Иван, менеджер. Чем могу помочь?';
        // Persist BEFORE the bot send so the admin timeline carries the welcome
        // even if Telegram is briefly unreachable.
        await messagesRepo.create(app.db, {
          clientId: client.id,
          leadId: lead.id,
          role: 'manager',
          text: welcome,
        });
        const bot = (
          app as typeof app & { bot?: { api: { sendMessage: typeof app.bot.api.sendMessage } } }
        ).bot;
        if (bot) {
          await bot.api.sendMessage(client.telegramId, welcome).catch((err: unknown) => {
            app.log.warn({ err, leadId: lead.id }, 'intercept: welcome send failed');
          });
        }
      }
      return reply.code(200).send({ lead_id: lead.id, manager_active: true as const });
    }
  );

  // Phase 3 Plan 03-05 TG-06 — Manager sends an outbound message via the bot.
  //
  // Persists with role='manager' so the timeline mirrors the client's view,
  // then forwards to Telegram. Returns 400 if the client has no telegram_id
  // (a manager-message has nowhere to go).
  app.post(
    '/leads/:id/manager-message',
    {
      schema: {
        tags: ['leads'],
        summary: 'Manager outbound message via bot (Phase 3 TG-06)',
        params: z.object({ id: z.string().uuid() }),
        body: ManagerMessageBodySchema,
        response: { 200: ManagerMessageResponseSchema, 400: NotImpl, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const lead = await leadsRepo.findById(app.db, req.params.id);
      if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
      const client = await clientsRepo.findById(app.db, lead.clientId);
      if (!client) return reply.notFound('client not found');
      if (!client.telegramId) return reply.badRequest('client has no telegram_id');

      await messagesRepo.create(app.db, {
        clientId: client.id,
        leadId: lead.id,
        role: 'manager',
        text: req.body.text,
      });

      const bot = (
        app as typeof app & { bot?: { api: { sendMessage: typeof app.bot.api.sendMessage } } }
      ).bot;
      if (bot) {
        await bot.api.sendMessage(client.telegramId, req.body.text).catch((err: unknown) => {
          app.log.error({ err, leadId: lead.id }, 'manager-message: send failed');
        });
      }
      return reply.code(200).send({ lead_id: lead.id });
    }
  );

  // Phase 3 Plan 03-05 TG-06 — Manager hands the conversation back to the bot.
  //
  // Flips leads.manager_active=false; subsequent inbound flows back through
  // intake.ts. Delivers a localized handover notification + persists it. Errors
  // on the bot send are swallowed; the flag flip is the contract.
  app.post(
    '/leads/:id/release',
    {
      schema: {
        tags: ['leads'],
        summary: 'Manager release (Phase 3 TG-06)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: LeadReleaseResponseSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const lead = await leadsRepo.findById(app.db, req.params.id);
      if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
      await app.db.execute(sql`
        UPDATE leads SET manager_active = false, updated_at = NOW()
        WHERE id = ${lead.id}
      `);
      const client = await clientsRepo.findById(app.db, lead.clientId);
      if (client?.telegramId) {
        const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
        const handover =
          lang === 'ua'
            ? 'Передаю назад AI-асистенту. Чим іще можу допомогти?'
            : 'Передаю обратно AI-ассистенту. Что-то ещё?';
        await messagesRepo.create(app.db, {
          clientId: client.id,
          leadId: lead.id,
          role: 'manager',
          text: handover,
        });
        const bot = (
          app as typeof app & { bot?: { api: { sendMessage: typeof app.bot.api.sendMessage } } }
        ).bot;
        if (bot) {
          await bot.api.sendMessage(client.telegramId, handover).catch(() => {
            /* swallow — manager already saw the flag flip in the admin */
          });
        }
      }
      return reply.code(200).send({ lead_id: lead.id, manager_active: false as const });
    }
  );
};

export default leadsRoutes;
