// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/trucks — covers list, create, patch.
// Phase 4 ADMIN-NEW-01 will use these for the fleet management UI.

import { z } from 'zod/v4';
import { BodyType, TruckStatus } from '../domain/enums.js';

export const TruckSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  plateNumber: z.string(),
  driverName: z.string(),
  driverPhone: z.string(),
  driverTelegramId: z.string().nullable(),
  capacityT: z.number(),
  bodyType: BodyType,
  status: TruckStatus,
  geom: z.object({ lng: z.number(), lat: z.number() }),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type Truck = z.infer<typeof TruckSchema>;

export const TruckListQuerySchema = z.object({
  status: TruckStatus.optional(),
  bodyType: BodyType.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TruckListQuery = z.infer<typeof TruckListQuerySchema>;

export const CreateTruckBodySchema = z.object({
  name: z.string().min(1),
  plateNumber: z.string().min(1),
  driverName: z.string().min(1),
  driverPhone: z.string().min(1),
  driverTelegramId: z.string().optional(),
  capacityT: z.number().int().positive(),
  bodyType: BodyType,
  geom: z.object({ lng: z.number(), lat: z.number() }),
  status: TruckStatus.default('available'),
});
export type CreateTruckBody = z.infer<typeof CreateTruckBodySchema>;

export const PatchTruckBodySchema = CreateTruckBodySchema.partial();
export type PatchTruckBody = z.infer<typeof PatchTruckBodySchema>;
