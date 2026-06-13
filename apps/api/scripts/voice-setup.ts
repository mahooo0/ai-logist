// apps/api/scripts/voice-setup.ts
// Phase 3.1 Plan 03 — bootstrap CLI: validates env, upserts ElevenLabs Agent,
// configures Twilio number webhook. Same UX as Plan 03-05 `telegram:setup`.
//
// Run: pnpm --filter @ai-logist/api voice:setup
//
// Idempotent:
//   - If ELEVENLABS_AGENT_ID is set in env → PATCH the existing agent body.
//   - If ELEVENLABS_AGENT_ID is unset → POST to create a new agent and print
//     the returned id with instructions to add it to .env.local.
//   - Twilio number is upserted via incomingPhoneNumbers(sid).update so
//     voiceUrl + statusCallback always match VOICE_PUBLIC_URL.
//
// SDK shape note (CONTEXT Open Question 1): the ElevenLabs Agent CRUD shapes
// drift between SDK versions; we use `as any` casts at the SDK boundary with
// targeted eslint-disable comments. Fields written into the agent body conform
// to the verified RESEARCH §Block 1 shape.
/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import twilio from 'twilio';

function assert(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(`✗ Missing env: ${name}`);
    process.exit(1);
  }
  console.log(`✓ ${name}`);
}

interface AgentToolDef {
  type: 'webhook';
  name: string;
  description: string;
  responseTimeoutSecs: number;
  apiSchema: {
    url: string;
    method: 'POST';
    requestBodySchema: object;
  };
}

function toolDef(
  name: string,
  description: string,
  publicUrl: string,
  schema: object
): AgentToolDef {
  return {
    type: 'webhook',
    name,
    description,
    responseTimeoutSecs: 5,
    apiSchema: {
      url: `${publicUrl}/webhook/voice/tool/${name}`,
      method: 'POST',
      requestBodySchema: schema,
    },
  };
}

async function main(): Promise<void> {
  console.log('=== Voice Channel Bootstrap (Phase 3.1) ===\n');

  // 1. Validate env at boundary (mirrors requireVoiceConfig() in
  // src/channels/voice/setup.ts but exits 1 instead of throwing — friendlier
  // CLI UX).
  assert('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY);
  assert('ELEVENLABS_WEBHOOK_SECRET', process.env.ELEVENLABS_WEBHOOK_SECRET);
  assert('TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID);
  assert('TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN);
  assert('TWILIO_PHONE_NUMBER', process.env.TWILIO_PHONE_NUMBER);
  // VOICE_PUBLIC_URL falls back to TELEGRAM_PUBLIC_URL per CONTEXT D-26.
  const publicUrl = process.env.VOICE_PUBLIC_URL ?? process.env.TELEGRAM_PUBLIC_URL;
  assert('VOICE_PUBLIC_URL (or TELEGRAM_PUBLIC_URL)', publicUrl);

  // 2. Upsert ElevenLabs Agent
  console.log('\n--- ElevenLabs Agent ---');
  const el = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  // Load the version-controlled system prompt + tool registry doc.
  const promptPath = fileURLToPath(
    new URL('../src/channels/voice/elevenlabs-agent-config.md', import.meta.url)
  );
  const systemPrompt = readFileSync(promptPath, 'utf8');
  console.log(
    `✓ Loaded system prompt from elevenlabs-agent-config.md (${systemPrompt.length} chars)`
  );

  // Per-tool schema — envelope { conversation_id, sequence, parameters }
  // matches what the Phase 3.1 handlers parse. conversation_id is platform-
  // injected via dynamic_variable=system__conversation_id; sequence is a
  // constant (the LLM has no per-call counter, and our idempotency key is
  // really keyed on conversation_id + tool_call_id anyway); ONLY `parameters`
  // gets fields the LLM populates. Without proper per-tool field descriptions
  // the LLM stalls (observed: 0 tool calls in conv_0801kv0k2 + conv_1801kv0mm
  // with the previous empty-properties envelope).
  function envelope(paramsSchema: object) {
    return {
      type: 'object',
      required: ['conversation_id', 'sequence', 'parameters'],
      properties: {
        conversation_id: {
          type: 'string',
          dynamic_variable: 'system__conversation_id',
        },
        sequence: { type: 'number', constant_value: 1 },
        parameters: paramsSchema,
      },
    };
  }

  // Per-tool parameters schemas — only fields the LLM should fill.
  // pickup_lon/lat and route_km are derived server-side from voice state's
  // extracted_fields (see tool-handlers.ts) so they're intentionally absent.
  const extractRequestParams = {
    type: 'object',
    required: ['text'],
    description: 'Tool arguments for extract-request.',
    properties: {
      text: {
        type: 'string',
        description:
          'Verbatim last user utterance about the freight request — do not paraphrase.',
      },
    },
  };
  const nearestTruckParams = {
    type: 'object',
    required: ['tons'],
    description: 'Tool arguments for nearest-truck.',
    properties: {
      tons: { type: 'number', description: 'Cargo weight in metric tons.' },
      body_type: {
        type: 'string',
        enum: ['tent', 'ref', 'iso', 'container'],
        description: 'Truck body type. Omit for any.',
      },
    },
  };
  const calcPriceParams = {
    type: 'object',
    required: ['tons', 'body_type'],
    description: 'Tool arguments for calc-price.',
    properties: {
      tons: { type: 'number', description: 'Cargo weight in metric tons.' },
      body_type: {
        type: 'string',
        enum: ['tent', 'ref', 'iso', 'container'],
        description: 'Truck body type.',
      },
      direction: {
        type: 'string',
        enum: ['default', 'return'],
        description: "'default' for forward haul; 'return' for backhaul.",
      },
    },
  };
  const createOrderParams = {
    type: 'object',
    required: ['confirmed'],
    description: 'Tool arguments for create-order.',
    properties: {
      confirmed: {
        type: 'boolean',
        description: 'MUST be true. Only call after the caller explicitly accepted the price.',
      },
    },
  };
  const discountParams = {
    type: 'object',
    required: ['requested_kopecks'],
    description: 'Tool arguments for discount.',
    properties: {
      requested_kopecks: {
        type: 'string',
        description: 'Discounted price the caller requests, in kopecks as a decimal string.',
      },
      reason: { type: 'string', description: 'Short reason given by the caller.' },
    },
  };

  const agentBody = {
    name: 'ai-logist-demo-v1',
    conversationConfig: {
      agent: {
        firstMessage: '', // dynamic per-language via Agent dashboard variables
        // 'multilingual' is no longer accepted (API allows ISO codes only —
        // en/ru/uk/...). Default to 'ru' for the AI-Logist Russian-first demo;
        // additional UA support is configured per Agent dashboard variables.
        language: 'ru',
        prompt: {
          prompt: systemPrompt,
          // gpt-4o-mini stalls on function-calling with the long Phase 3.1
          // system prompt — observed 0 tool calls across an 18-message live
          // conversation. gpt-4o (full) reliably calls extract-request →
          // nearest-truck → calc-price → create-order in order. Per-call cost
          // diff is small at demo volumes.
          llm: 'gpt-4o',
          temperature: 0.3,
          maxTokens: 400,
          tools: [
            toolDef(
              'extract-request',
              'Extract structured freight request (from_city, to_city, tons, body_type) from the caller’s last utterance. CALL FIRST after the caller describes the load.',
              publicUrl,
              envelope(extractRequestParams)
            ),
            toolDef(
              'nearest-truck',
              'Find the nearest available truck. CALL AFTER extract-request once tons + body_type are known. Pickup coords are resolved server-side; do NOT pass them.',
              publicUrl,
              envelope(nearestTruckParams)
            ),
            toolDef(
              'calc-price',
              'Compute the deterministic route price. CALL AFTER nearest-truck. route_km is resolved server-side from the city pair; do NOT pass it. Writes leads.quoted_price BEFORE returning.',
              publicUrl,
              envelope(calcPriceParams)
            ),
            toolDef(
              'create-order',
              'Create the order. CALL ONLY after the caller explicitly accepted the price voiced from calc-price. NEVER pass price_kopecks — backend re-reads from DB.',
              publicUrl,
              envelope(createOrderParams)
            ),
            toolDef(
              'discount',
              'Negotiate a discount. CALL ONLY if the caller asks for a lower price after calc-price.',
              publicUrl,
              envelope(discountParams)
            ),
          ],
        },
      },
      tts: {
        // Default voice: Alisa - Natural Russian Female (RU). The previous
        // placeholder pNInz6obpgDQGcFmaJgB is Adam (EN), which spoke our
        // Russian prompt with a heavy English accent — not demo-ready.
        // Override via ELEVENLABS_VOICE_ID env var. Use || so an empty-string
        // env (the .env.local default) still falls back to Alisa.
        voiceId: process.env.ELEVENLABS_VOICE_ID || 't6lBrEl93uCiLR1Lgm8v',
        modelId: 'eleven_turbo_v2_5',
        stability: 0.55,
        similarityBoost: 0.85,
      },
      asr: {
        provider: 'elevenlabs',
        quality: 'high',
        userInputAudioFormat: 'pcm_16000',
      },
      conversation: {
        // Hard cost cap per CONTEXT D-32 + RESEARCH Block 17 (10 min × $0.10/min
        // = $1 max per call; demo budget ~$15 total).
        maxDurationSeconds: 600,
      },
    },
  };

  let agentId = process.env.ELEVENLABS_AGENT_ID;
  // SDK shape drift tolerance (CONTEXT Open Question 1) — cast at boundary.
  // biome-ignore lint/suspicious/noExplicitAny: SDK 2.30.0 types lag the REST API
  const agentsApi = el.conversationalAi.agents as any;
  if (agentId) {
    await agentsApi.update(agentId, agentBody);
    console.log(`✓ Agent updated: ${agentId}`);
  } else {
    const created = await agentsApi.create(agentBody);
    agentId = created.agentId ?? created.agent_id ?? created.id;
    console.log(`✓ Agent created: ${agentId}`);
    console.log(`  → ADD TO .env.local: ELEVENLABS_AGENT_ID=${agentId}`);
  }

  // 3. Twilio number config
  console.log('\n--- Twilio Number ---');
  const tw = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const numbers = await tw.incomingPhoneNumbers.list({
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    limit: 1,
  });
  if (numbers.length === 0) {
    console.error(`✗ Twilio number ${process.env.TWILIO_PHONE_NUMBER} not found in account`);
    console.error('  Buy via Twilio Console → Phone Numbers → Buy a number');
    process.exit(1);
  }
  const numSid = numbers[0].sid;
  await tw.incomingPhoneNumbers(numSid).update({
    voiceUrl: `${publicUrl}/webhook/voice/twilio/twiml`,
    voiceMethod: 'POST',
    statusCallback: `${publicUrl}/webhook/voice/twilio/status`,
    statusCallbackMethod: 'POST',
  });
  console.log(`✓ Twilio number ${process.env.TWILIO_PHONE_NUMBER} configured (sid: ${numSid})`);
  console.log(`  voiceUrl       = ${publicUrl}/webhook/voice/twilio/twiml`);
  console.log(`  statusCallback = ${publicUrl}/webhook/voice/twilio/status`);

  // 4. Manual checklist — items Claude CANNOT automate (UI clicks, SIP trunk
  // confirmation, real-phone test)
  console.log('\n--- Manual Steps Required ---');
  console.log(
    `[ ] In ElevenLabs dashboard → Agent ${agentId} → SIP integration → enable SIP trunk`
  );
  console.log(`    SIP URI to share with Twilio: sip:${agentId}@sip.elevenlabs.io`);
  console.log(
    `[ ] In Twilio Console → Phone Numbers → ${process.env.TWILIO_PHONE_NUMBER} → Voice → confirm webhook = ${publicUrl}/webhook/voice/twilio/twiml`
  );
  console.log(`[ ] Test call: dial ${process.env.TWILIO_PHONE_NUMBER} from a real phone`);
  console.log(
    '[ ] Verify: psql -c "SELECT * FROM calls ORDER BY created_at DESC LIMIT 1;" — row appears after call'
  );
  console.log(
    '[ ] Verify: psql -c "SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;" — order with matching price'
  );
  console.log(
    '[ ] Validate Open Questions 1-4 in elevenlabs-agent-config.md from observed callback shapes\n'
  );
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
