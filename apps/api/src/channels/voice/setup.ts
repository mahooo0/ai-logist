// apps/api/src/channels/voice/setup.ts
// Phase 3.1 — runtime guard called at plugin/route boundary (CONTEXT D-27).
// Same pattern as requireTelegramConfig from Plan 03-01: env vars are .optional()
// in Zod (Phase 2 unit tests boot without them) and this helper throws when the
// voice plugin is actually invoked without a complete config.
import { config } from '../../config.js';

export interface VoiceConfig {
  elevenlabsApiKey: string;
  elevenlabsAgentId: string;
  elevenlabsWebhookSecret: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioWebhookSignatureSecret: string;
  voicePublicUrl: string;
}

/**
 * Throws Error('voice config missing: ...') if any required field is undefined.
 *
 * Fallbacks per CONTEXT D-26:
 *   - TWILIO_WEBHOOK_SIGNATURE_SECRET defaults to TWILIO_AUTH_TOKEN (Twilio
 *     signs with the auth token; explicit override only if proxied).
 *   - VOICE_PUBLIC_URL defaults to TELEGRAM_PUBLIC_URL (single ngrok tunnel
 *     in dev; multiple in prod).
 */
export function requireVoiceConfig(): VoiceConfig {
  const missing: string[] = [];

  const elevenlabsApiKey = config.ELEVENLABS_API_KEY;
  const elevenlabsAgentId = config.ELEVENLABS_AGENT_ID;
  const elevenlabsWebhookSecret = config.ELEVENLABS_WEBHOOK_SECRET;
  const twilioAccountSid = config.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = config.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = config.TWILIO_PHONE_NUMBER;
  const twilioWebhookSignatureSecret =
    config.TWILIO_WEBHOOK_SIGNATURE_SECRET ?? config.TWILIO_AUTH_TOKEN;
  const voicePublicUrl = config.VOICE_PUBLIC_URL ?? config.TELEGRAM_PUBLIC_URL;

  if (!elevenlabsApiKey) missing.push('ELEVENLABS_API_KEY');
  if (!elevenlabsAgentId) missing.push('ELEVENLABS_AGENT_ID');
  if (!elevenlabsWebhookSecret) missing.push('ELEVENLABS_WEBHOOK_SECRET');
  if (!twilioAccountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!twilioAuthToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!twilioPhoneNumber) missing.push('TWILIO_PHONE_NUMBER');
  if (!twilioWebhookSignatureSecret) missing.push('TWILIO_WEBHOOK_SIGNATURE_SECRET');
  if (!voicePublicUrl) missing.push('VOICE_PUBLIC_URL (or TELEGRAM_PUBLIC_URL)');

  if (missing.length > 0) {
    throw new Error(`voice config missing: ${missing.join(', ')}`);
  }

  // All `missing.push` paths guarded above — every captured const is defined here.
  return {
    elevenlabsApiKey: elevenlabsApiKey as string,
    elevenlabsAgentId: elevenlabsAgentId as string,
    elevenlabsWebhookSecret: elevenlabsWebhookSecret as string,
    twilioAccountSid: twilioAccountSid as string,
    twilioAuthToken: twilioAuthToken as string,
    twilioPhoneNumber: twilioPhoneNumber as string,
    twilioWebhookSignatureSecret: twilioWebhookSignatureSecret as string,
    voicePublicUrl: voicePublicUrl as string,
  };
}
