// apps/api/src/channels/voice/call-lifecycle.ts
//
// Phase 3.1 — call-start / call-end / lang-detected handlers.
// CONTEXT D-14 (call-start INSERT), D-15 (call-end UPDATE idempotent),
// D-16 (lang-detected sticky NULL guard), D-17 (existing client sticky lang).
//
// All routes register under the parent webhooks-voice.ts router which wires
// the raw-body content-type parser + HMAC preHandler.
//
// Sticky-lang implementation note: clients.lang is NOT NULL DEFAULT 'ru' in
// migration 0001 (Phase 1). We cannot distinguish "set" vs "default-ru". The
// workable sticky rule for v1: only update clients.lang from lang-detected
// when no prior call for this client already recorded a lang. The subquery
// "NOT EXISTS (SELECT 1 FROM calls WHERE client_id = X AND lang IS NOT NULL)"
// makes the first-ever lang-detected event for a client persistent. Subsequent
// lang-detected events on later calls are no-ops at the clients.lang level.
//
// CONTEXT D-19 sticky semantics preserved via this DB-side guard.

import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod/v4';
import { mergeVoiceState, setVoiceState } from './state.js';

const CallStartSchema = z.object({
  conversation_id: z.string().min(1),
  agent_id: z.string().optional(),
  twilio_call_sid: z.string().optional(),
  caller_phone: z.string().optional(),
  language_hint: z.enum(['ru', 'ua']).optional(),
});

const TranscriptSegmentSchema = z.object({
  role: z.enum(['agent', 'caller']),
  text: z.string(),
  timestamp_ms: z.number(),
});

const CallEndSchema = z.object({
  conversation_id: z.string().min(1),
  audio_url: z.string().url().optional(),
  transcript: z.array(TranscriptSegmentSchema).default([]),
  outcome: z.enum(['completed', 'abandoned', 'escalated', 'error']),
  duration_s: z.number().int().nonnegative(),
  lang: z.enum(['ru', 'ua']).optional(),
  linked_lead_id: z.string().uuid().optional(),
});

const LangDetectedSchema = z.object({
  conversation_id: z.string().min(1),
  lang: z.enum(['ru', 'ua']),
});

const callLifecyclePlugin: FastifyPluginAsync = async (app) => {
  // ─── call-start ──────────────────────────────────────────────────────
  // INSERTs a calls row (upsert on elevenlabs_conversation_id), looks up or
  // creates a client by caller_phone (E.164), creates a lead skeleton so
  // subsequent tool handlers have a lead_id, and seeds Redis voice state.
  app.post('/voice/call-start', async (req, reply) => {
    const body = CallStartSchema.parse(req.body);
    const { conversation_id, twilio_call_sid, caller_phone, language_hint } = body;

    // 1. Upsert calls row keyed on elevenlabs_conversation_id (UNIQUE partial idx).
    const insert = await app.db.execute(sql`
      INSERT INTO calls (
        elevenlabs_conversation_id, twilio_call_sid, direction, created_at
      ) VALUES (
        ${conversation_id}, ${twilio_call_sid ?? null}, 'inbound', NOW()
      )
      ON CONFLICT (elevenlabs_conversation_id)
        DO UPDATE SET
          twilio_call_sid = COALESCE(calls.twilio_call_sid, EXCLUDED.twilio_call_sid)
      RETURNING id::text AS id, lead_id::text AS lead_id
    `);
    const call = insert.rows[0] as { id: string; lead_id: string | null };

    // 2. Find or create client by phone. Phone is E.164; if absent, synthesize
    //    a per-conversation placeholder (voice:<conv>) so the FK constraints hold.
    let clientId: string;
    let stickyLang: 'ru' | 'ua' | null = null;
    if (caller_phone) {
      const found = await app.db.execute(sql`
        SELECT id::text AS id, lang FROM clients WHERE phone = ${caller_phone} LIMIT 1
      `);
      if (found.rows.length > 0) {
        const row = found.rows[0] as { id: string; lang: 'ru' | 'ua' };
        clientId = row.id;
        stickyLang = row.lang;
      } else {
        const created = await app.db.execute(sql`
          INSERT INTO clients (name, phone, lang)
          VALUES (${`voice:${conversation_id}`}, ${caller_phone}, ${language_hint ?? 'ru'}::client_lang)
          RETURNING id::text AS id, lang
        `);
        const row = created.rows[0] as { id: string; lang: 'ru' | 'ua' };
        clientId = row.id;
        stickyLang = row.lang;
      }
    } else {
      const placeholderPhone = `voice:${conversation_id}`;
      const created = await app.db.execute(sql`
        INSERT INTO clients (name, phone, lang)
        VALUES (${`voice:${conversation_id}`}, ${placeholderPhone}, ${language_hint ?? 'ru'}::client_lang)
        ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
        RETURNING id::text AS id, lang
      `);
      const row = created.rows[0] as { id: string; lang: 'ru' | 'ua' };
      clientId = row.id;
      stickyLang = row.lang;
    }

    // Effective lang for the Agent on this call: sticky DB value wins,
    // language_hint fills if sticky is somehow null (shouldn't happen with
    // NOT NULL DEFAULT 'ru' but defensive). CONTEXT D-17.
    const effectiveLang: 'ru' | 'ua' = stickyLang ?? language_hint ?? 'ru';

    // 3. Create lead skeleton so subsequent tool handlers have a lead_id.
    //    channel='voice' per CONTEXT D-13.
    const leadIns = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version)
      VALUES (${clientId}::uuid, 'voice', 'NEW', 0)
      RETURNING id::text AS id
    `);
    const leadId = (leadIns.rows[0] as { id: string }).id;

    // 4. Link the calls row to the lead.
    await app.db.execute(sql`
      UPDATE calls SET lead_id = ${leadId}::uuid WHERE id = ${call.id}::uuid
    `);

    // 5. Seed Redis voice state for tool handlers to read.
    await setVoiceState(app.redis, {
      conversation_id,
      client_id: clientId,
      lead_id: leadId,
      lang: effectiveLang,
      twilio_call_sid: twilio_call_sid ?? null,
      created_at: new Date().toISOString(),
    });

    req.log.info({ conversation_id, clientId, leadId, lang: effectiveLang }, 'voice.call.started');
    return reply.send({ ok: true, output: { lead_id: leadId, lang: effectiveLang } });
  });

  // ─── call-end (idempotent — COALESCE for late arrivals) ─────────────
  // The same callback may arrive multiple times if ElevenLabs retries on a
  // timeout. COALESCE preserves existing non-null values; jsonb transcript is
  // overwritten with the canonical version on every call (latest wins).
  // CONTEXT D-15.
  app.post('/voice/call-end', async (req, reply) => {
    const body = CallEndSchema.parse(req.body);
    const { conversation_id, audio_url, transcript, outcome, duration_s, lang, linked_lead_id } =
      body;

    await app.db.execute(sql`
      UPDATE calls SET
        audio_url = COALESCE(${audio_url ?? null}, audio_url),
        transcript = ${JSON.stringify(transcript)}::jsonb,
        outcome = ${outcome}::call_outcome,
        duration_s = ${duration_s},
        lang = COALESCE(${lang ?? null}::client_lang, lang),
        linked_lead_id = COALESCE(${linked_lead_id ?? null}::uuid, linked_lead_id)
      WHERE elevenlabs_conversation_id = ${conversation_id}
    `);

    // Clear Redis state — call is over, free the memory.
    await app.redis.del(`voice:state:${conversation_id}`);
    req.log.info({ conversation_id, outcome, duration_s }, 'voice.call.ended');
    return reply.send({ ok: true });
  });

  // ─── lang-detected (sticky-once on clients.lang — CONTEXT D-16) ─────
  //
  // calls.lang is set if currently NULL. clients.lang is set ONLY if no prior
  // call for this client already recorded a lang — the first lang-detected
  // event for a client persists; subsequent ones are no-ops at the client
  // level. Defends against Surzhyk-induced flipping mid-relationship.
  app.post('/voice/lang-detected', async (req, reply) => {
    const body = LangDetectedSchema.parse(req.body);
    const { conversation_id, lang } = body;

    // Update calls.lang for THIS call only if currently NULL.
    await app.db.execute(sql`
      UPDATE calls SET lang = ${lang}::client_lang
      WHERE elevenlabs_conversation_id = ${conversation_id}
        AND lang IS NULL
    `);

    // Sticky clients.lang: only set if no other call for this client already
    // recorded a non-null lang. We resolve the client_id via the current call
    // row and check the existence of any sibling call with a populated lang.
    await app.db.execute(sql`
      UPDATE clients SET lang = ${lang}::client_lang
      WHERE id = (
        SELECT client_id FROM (
          SELECT lead_id FROM calls
          WHERE elevenlabs_conversation_id = ${conversation_id}
          LIMIT 1
        ) c
        JOIN leads l ON l.id = c.lead_id
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM calls sibling
        JOIN leads sl ON sl.id = sibling.lead_id
        WHERE sl.client_id = clients.id
          AND sibling.lang IS NOT NULL
          AND sibling.elevenlabs_conversation_id <> ${conversation_id}
      )
    `);

    await mergeVoiceState(app.redis, conversation_id, { lang });

    req.log.info({ conversation_id, lang }, 'voice.lang.detected');
    return reply.send({ ok: true });
  });
};

export default callLifecyclePlugin;
