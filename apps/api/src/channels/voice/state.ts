// apps/api/src/channels/voice/state.ts
// Phase 3.1 — Redis voice-state CRUD per CONTEXT D-18. TTL 60min. bigint-safe serialization.
//
// Key shape: voice:state:<conversation_id>
// TTL: 3600s (typical call < 30 min; gives 30 min slack for slow hangups).
// bigint encoding: `{__bigint: "<decimal>"}` — JSON.stringify can't serialize bigints
// natively. The shape is symmetric on read so quoted_price round-trips without
// precision loss (kopecks need full 64-bit range).
import type { Redis } from 'ioredis';

const KEY = (conversationId: string): string => `voice:state:${conversationId}`;
const TTL_SECONDS = 60 * 60;

export interface VoiceState {
  conversation_id: string;
  client_id: string;
  lead_id: string;
  lang: 'ru' | 'ua' | null;
  extracted_fields?: {
    from_city: string | null;
    to_city: string | null;
    tons: number | null;
    body_type: 'tent' | 'ref' | 'iso' | 'container' | null;
  };
  matched_truck?: { id: string; meters: number } | null;
  quoted_price?: bigint | null;
  twilio_call_sid?: string | null;
  created_at: string; // ISO timestamp
  // Outbound confirmation-flow context — set when dialOrderConfirmation
  // pre-seeds Redis. confirmLoading/confirmDelivery tool handlers prefer
  // this over args.order_id (so the caller's dynamic_variables can't be
  // forged to confirm a different order than the one we dialed).
  order_id?: string;
  flow?: 'loading_confirmation' | 'delivery_confirmation';
}

// JSON replacer — encode bigint as { __bigint: "<decimal>" } sentinel.
function replacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? { __bigint: (v as bigint).toString() } : v;
}

// JSON reviver — decode { __bigint: ... } sentinel back to bigint.
function reviver(_k: string, v: unknown): unknown {
  if (v && typeof v === 'object' && '__bigint' in (v as Record<string, unknown>)) {
    return BigInt((v as { __bigint: string }).__bigint);
  }
  return v;
}

export async function setVoiceState(redis: Redis, state: VoiceState): Promise<void> {
  await redis.set(KEY(state.conversation_id), JSON.stringify(state, replacer), 'EX', TTL_SECONDS);
}

export async function getVoiceState(
  redis: Redis,
  conversationId: string
): Promise<VoiceState | null> {
  const raw = await redis.get(KEY(conversationId));
  if (!raw) return null;
  return JSON.parse(raw, reviver) as VoiceState;
}

export async function mergeVoiceState(
  redis: Redis,
  conversationId: string,
  partial: Partial<VoiceState>
): Promise<VoiceState | null> {
  const existing = await getVoiceState(redis, conversationId);
  if (!existing) return null;
  const merged: VoiceState = { ...existing, ...partial };
  await setVoiceState(redis, merged);
  return merged;
}

export async function deleteVoiceState(redis: Redis, conversationId: string): Promise<void> {
  await redis.del(KEY(conversationId));
}
