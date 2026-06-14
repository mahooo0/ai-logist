// apps/api/scripts/voice-setup-confirm.ts
// Voice-confirmation demo flow — bootstrap CLI for the SECOND ElevenLabs agent
// (separate from the intake agent created by voice-setup.ts).
//
// Run: pnpm --filter @ai-logist/api voice:setup-confirm
//
// This agent handles the two confirmation flows (loading + delivery) AND
// inbound status queries. It branches on `dynamic_variables.flow`. See
// `src/channels/voice/confirmation-agent-config.md` for the system prompt.
//
// Idempotent:
//   - If ELEVENLABS_AGENT_ID_CONFIRM is set → PATCH the existing agent body.
//   - If unset → POST to create + print the new ID with .env instructions.
//
// IMPORTANT: This script does NOT reconfigure Twilio. The Twilio webhook URL
// stays pointed at `/webhook/voice/twilio/twiml`, which now reads
// ELEVENLABS_AGENT_ID_CONFIRM to decide which agent handles inbound calls.
// Outbound calls bypass the webhook — they're dispatched via the ElevenLabs
// `/v1/convai/twilio/outbound-call` API directly (see dialOrderConfirmation in
// src/channels/voice/outbound.ts).
/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function assert(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(`✗ Missing env: ${name}`);
    process.exit(1);
  }
  console.log(`✓ ${name}`);
}

// Build a snake_case tool definition for raw REST. We POST snake_case
// directly because the SDK's camelCase→snake_case body transform strips
// nested unknown keys like `dynamic_variable`/`constant_value` from the
// JSON-Schema, which the ElevenLabs validator then rejects with 422.
function toolDef(
  name: string,
  description: string,
  publicUrl: string,
  schema: object
): Record<string, unknown> {
  return {
    type: 'webhook',
    name,
    description,
    response_timeout_secs: 5,
    api_schema: {
      url: `${publicUrl}/webhook/voice/tool/${name}`,
      method: 'POST',
      request_body_schema: schema,
    },
  };
}

async function main(): Promise<void> {
  console.log('=== Voice Confirmation Agent Bootstrap ===\n');

  assert('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY);
  assert('ELEVENLABS_WEBHOOK_SECRET', process.env.ELEVENLABS_WEBHOOK_SECRET);
  const publicUrl = process.env.VOICE_PUBLIC_URL ?? process.env.TELEGRAM_PUBLIC_URL;
  assert('VOICE_PUBLIC_URL (or TELEGRAM_PUBLIC_URL)', publicUrl);

  // Heads-up: outbound dialing requires ELEVENLABS_PHONE_NUMBER_ID too, but
  // that's a runtime concern (dialOrderConfirmation reads it). Inbound flow
  // works even without it.
  if (!process.env.ELEVENLABS_PHONE_NUMBER_ID) {
    console.log(
      '⚠ ELEVENLABS_PHONE_NUMBER_ID not set — inbound queries will work but outbound confirmation dialing will be disabled until you add it.'
    );
  } else {
    console.log(`✓ ELEVENLABS_PHONE_NUMBER_ID`);
  }

  console.log('\n--- ElevenLabs Agent ---');

  const promptPath = fileURLToPath(
    new URL('../src/channels/voice/confirmation-agent-config.md', import.meta.url)
  );
  const systemPrompt = readFileSync(promptPath, 'utf8');
  console.log(
    `✓ Loaded confirmation prompt from confirmation-agent-config.md (${systemPrompt.length} chars)`
  );

  // Same per-tool envelope shape as the intake agent — required + parameters
  // wrapper, conversation_id injected via the platform dynamic variable.
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

  // confirmLoading / confirmDelivery / getOrderContext: order_id is OPTIONAL
  // because the backend prefers Redis state (pre-seeded by our dialer) over
  // the agent's dynamic variable. Document it in the description so the LLM
  // still passes it when it has the value.
  const orderIdOnly = {
    type: 'object',
    required: [],
    description: 'Tool arguments. order_id is optional — the backend resolves it from call state when omitted.',
    properties: {
      order_id: {
        type: 'string',
        description: 'UUID of the order. Pass through dynamic_variable {{order_id}} when available.',
      },
    },
  };

  const lookupOrderParams = {
    type: 'object',
    required: ['order_number'],
    description: 'Look up an order by its public number.',
    properties: {
      order_number: {
        type: 'string',
        description:
          'The order number the caller spoke. Accepts any of: "#KU-4471", "KU-4471", bare digits like "4471", or just "1".',
      },
    },
  };

  const agentBody = {
    name: 'ai-logist-confirm-query-v1',
    conversation_config: {
      agent: {
        // Default first_message — used ONLY on inbound calls. Outbound calls
        // override this per-call via conversation_config_override so the agent
        // immediately greets the caller with the stage-specific opening
        // (Машина приехала, подтверждаете загрузку?).
        first_message:
          'Здравствуйте, это АИ-Логист. Назовите, пожалуйста, номер заказа из Telegram.',
        language: 'ru',
        prompt: {
          prompt: systemPrompt,
          // gpt-4o (full) for reliability with function calling, matching the
          // intake agent's stack. Confirmation calls are short — cost is low.
          llm: 'gpt-4o',
          temperature: 0.3,
          max_tokens: 250,
          tools: [
            toolDef(
              'confirm-loading',
              [
                'Confirm the client is ready to load. CALL ONLY after the client',
                'explicitly said yes on the loading_confirmation flow. Pass',
                '{ "order_id": "{{order_id}}" } from the substituted dynamic variable;',
                'the backend also resolves order_id from call state, so passing it is',
                'optional. RESPONSE on success: { ok: true, output: { status:',
                '"IN_TRANSIT" | "already_confirmed", message_ru: string, message_ua: string } }.',
                'You should speak output.message_ru (or output.message_ua for UA',
                'callers) verbatim — it is the polite closing line. On {ok:false}',
                'apologize once and end the call.',
              ].join(' '),
              publicUrl,
              envelope(orderIdOnly)
            ),
            toolDef(
              'confirm-delivery',
              [
                'Confirm the client accepts the delivery. CALL ONLY after the client',
                'explicitly said yes on the delivery_confirmation flow. Pass',
                '{ "order_id": "{{order_id}}" } when available. RESPONSE on success:',
                '{ ok: true, output: { status: "AWAITING_PAYMENT" | "already_confirmed",',
                'message_ru: string, message_ua: string } }. Speak output.message_ru',
                '(or output.message_ua) verbatim — it tells the caller the payment',
                'link will arrive in Telegram. On {ok:false} apologize and end.',
              ].join(' '),
              publicUrl,
              envelope(orderIdOnly)
            ),
            toolDef(
              'lookup-order',
              [
                'Look up an order by its public number for the inbound status-query flow.',
                'CALL ONCE you have any recognizable number-like phrase from the caller',
                '(digits, "номер тысяча", "первый", "#1000", "тысяча один"). Pass the raw',
                'phrase verbatim in order_number — the backend normalizes word forms.',
                'RESPONSE shapes: FOUND: { ok: true, output: { found: true, order_number,',
                'plate, driver_name, driver_phone (string or null), pickup, delivery,',
                'stage_ru, stage_ua, progress_percent, status } }. Use these to compose',
                'ONE short status sentence in the caller language. ONLY dictate',
                'driver_phone if the caller explicitly asks for it. NOT FOUND:',
                '{ ok: true, output: { found: false, message_ru, message_ua } } — ask the',
                'caller to repeat the number; retry the tool ONCE if needed.',
              ].join(' '),
              publicUrl,
              envelope(lookupOrderParams)
            ),
            toolDef(
              'get-order-context',
              [
                'Fetch the truck + driver + cargo for the current confirmation call.',
                'CALL ONLY if the caller asks "what truck" / "who is driving" / "what',
                'cargo" before confirming AND the substituted dynamic variables',
                '({{plate}}, {{driver_name}}, {{cargo_summary}}) do not already answer.',
                'RESPONSE: { ok: true, output: { order_number, plate, driver_name,',
                'pickup, delivery, cargo_summary } }. Use these to compose ONE short',
                'sentence then bring the client back to the confirmation question.',
              ].join(' '),
              publicUrl,
              envelope(orderIdOnly)
            ),
          ],
        },
      },
      tts: {
        // Alisa Russian voice — same as the intake agent for brand consistency.
        voice_id: process.env.ELEVENLABS_VOICE_ID || 't6lBrEl93uCiLR1Lgm8v',
        model_id: 'eleven_turbo_v2_5',
        stability: 0.55,
        similarity_boost: 0.85,
      },
      asr: {
        provider: 'elevenlabs',
        quality: 'high',
        user_input_audio_format: 'pcm_16000',
      },
      conversation: {
        // Confirmation calls are short — 4 min cap saves cost on stuck calls.
        max_duration_seconds: 240,
      },
    },
  };

  let agentId = process.env.ELEVENLABS_AGENT_ID_CONFIRM;
  if (agentId) {
    const resp = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentBody),
    });
    if (!resp.ok) {
      console.error(`✗ Update failed: ${resp.status} ${await resp.text()}`);
      process.exit(1);
    }
    console.log(`✓ Confirmation agent updated: ${agentId}`);
  } else {
    const resp = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentBody),
    });
    if (!resp.ok) {
      console.error(`✗ Create failed: ${resp.status} ${await resp.text()}`);
      process.exit(1);
    }
    const created = (await resp.json()) as { agent_id?: string; agentId?: string; id?: string };
    agentId = created.agent_id ?? created.agentId ?? created.id;
    console.log(`✓ Confirmation agent created: ${agentId}`);
    console.log(`  → ADD TO .env.local: ELEVENLABS_AGENT_ID_CONFIRM=${agentId}`);
  }

  console.log('\n--- Next Steps ---');
  console.log(
    '[ ] If ELEVENLABS_PHONE_NUMBER_ID is unset: open ElevenLabs dashboard → Conversational AI → Phone Numbers → import your Twilio number → copy the phnum_... id into .env.local'
  );
  console.log(
    '[ ] If DEMO_CLIENT_PHONE is unset: add DEMO_CLIENT_PHONE=+9940552660728 to .env.local for the demo'
  );
  console.log(
    `[ ] curl test outbound: trigger an FSM transition to AT_LOADING — your demo phone should ring`
  );
  console.log(
    `[ ] curl test inbound: dial your Twilio number → agent should ask "назовите, пожалуйста, номер заказа"\n`
  );
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
