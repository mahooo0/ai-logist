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

  // Per-tool api_schema. ElevenLabs Agent platform validates the args struct
  // before invoking the webhook — use a permissive shape that accepts the
  // callback envelope keys; voice handlers do their own Zod re-validation.
  const baseSchema = {
    type: 'object',
    properties: {
      conversation_id: { type: 'string', description: 'ElevenLabs conversation identifier' },
      sequence: { type: 'number', description: 'Per-call tool invocation sequence number' },
      parameters: {
        type: 'object',
        description: 'Tool-specific arguments collected by the agent',
      },
    },
    required: ['conversation_id', 'sequence'],
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
              'Extract structured freight request from the caller speech',
              publicUrl,
              baseSchema
            ),
            toolDef(
              'nearest-truck',
              'Find the nearest available truck by pickup geo and capacity',
              publicUrl,
              baseSchema
            ),
            toolDef(
              'calc-price',
              'Compute the deterministic price for the route (writes leads.quoted_price before return)',
              publicUrl,
              baseSchema
            ),
            toolDef(
              'create-order',
              'Create the order (re-reads quoted_price from DB; NEVER pass price)',
              publicUrl,
              baseSchema
            ),
            toolDef(
              'discount',
              'Negotiate a discount within the corridor floor',
              publicUrl,
              baseSchema
            ),
          ],
        },
      },
      tts: {
        // Multilingual v2 placeholder; final voice_id finalized at UAT-04 per
        // RESEARCH Pitfall #7. Override via ELEVENLABS_VOICE_ID env var.
        // Use || so an empty-string env (the .env.local default) falls back too.
        voiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
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
