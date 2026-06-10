// Phase 1, Plan 01-08: 501 stubs for /api/trucks
// Phase 4 Plan 04-03 (API-05): GET /trucks flipped to read-only list.
// POST/PATCH remain 501 — fleet CRUD deferred to v2 (ADMIN-NEW-01 v2 scope).

import {
  CreateTruckBodySchema,
  PatchTruckBodySchema,
  TruckListQuerySchema,
  TruckSchema,
} from '@ai-logist/shared-types/api/trucks';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const trucksRoutes: FastifyPluginAsyncZod = async (app) => {
  // Phase 4 API-05 — read-only fleet list. Filters by status + bodyType.
  // Sorted by plate_number ASC (admin reads alphabetically).
  app.get(
    '/trucks',
    {
      schema: {
        tags: ['trucks'],
        summary: 'List fleet (Phase 4 API-05 read-only)',
        querystring: TruckListQuerySchema,
        response: { 200: z.array(TruckSchema) },
      },
    },
    async (req) => {
      const { status, bodyType, limit } = req.query;
      const conds: ReturnType<typeof sql>[] = [];
      if (status) conds.push(sql`status = ${status}`);
      if (bodyType) conds.push(sql`body_type = ${bodyType}`);
      const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = await app.db.execute(sql`
        SELECT id, name, plate_number AS "plateNumber",
               driver_name AS "driverName", driver_phone AS "driverPhone",
               driver_telegram_id AS "driverTelegramId",
               capacity_t AS "capacityT", body_type AS "bodyType", status,
               ST_AsGeoJSON(geom)::jsonb AS geom,
               updated_at AS "updatedAt", created_at AS "createdAt"
        FROM trucks
        ${whereClause}
        ORDER BY plate_number ASC
        LIMIT ${limit}
      `);
      return rows.rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        const tGeom = r.geom as { coordinates?: [number, number] } | null;
        return {
          id: r.id as string,
          name: r.name as string,
          plateNumber: r.plateNumber as string,
          driverName: r.driverName as string,
          driverPhone: r.driverPhone as string,
          driverTelegramId: (r.driverTelegramId as string | null) ?? null,
          capacityT: Number(r.capacityT),
          bodyType: r.bodyType as 'tent' | 'ref' | 'iso' | 'container',
          status: r.status as 'available' | 'busy' | 'maintenance',
          geom: tGeom?.coordinates
            ? { lng: Number(tGeom.coordinates[0]), lat: Number(tGeom.coordinates[1]) }
            : { lng: 0, lat: 0 },
          updatedAt: new Date(r.updatedAt as string | Date).toISOString(),
          createdAt: new Date(r.createdAt as string | Date).toISOString(),
        };
      });
    }
  );

  app.post(
    '/trucks',
    {
      schema: {
        tags: ['trucks'],
        summary: 'Add truck (Phase 4 v2 — deferred)',
        body: CreateTruckBodySchema,
        response: { 201: TruckSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('fleet CRUD deferred to v2')
  );

  app.patch(
    '/trucks/:id',
    {
      schema: {
        tags: ['trucks'],
        summary: 'Update truck (Phase 4 v2 — deferred)',
        params: z.object({ id: z.string().uuid() }),
        body: PatchTruckBodySchema,
        response: { 200: TruckSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('fleet CRUD deferred to v2')
  );
};

export default trucksRoutes;
