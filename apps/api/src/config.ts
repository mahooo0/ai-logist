import { z } from 'zod/v4';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Phase 2+ — optional in Phase 1 so the schema doesn't reject .env.local.
  // Optional at config level (tests use MockAnthropicClient); AnthropicLlmClient
  // constructor throws if instantiated in prod without a key.
  ANTHROPIC_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Phase 3 — additional Telegram env (D-30). Token + secret already declared
  // above as .optional() so Phase 2 tests boot without them. requireTelegramConfig()
  // below enforces presence at the plugin/route boundary.
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_PUBLIC_URL: z.string().url().optional(),
  TELEGRAM_SET_WEBHOOK_ON_BOOT: z.coerce.boolean().default(false),

  // Phase 2 — LLM pipeline + deterministic-core env vars.
  LLM_MODEL: z.string().default('claude-sonnet-4-7'),
  LLM_TOKEN_BUDGET_PER_LEAD: z.coerce.number().int().positive().default(30_000),
  OSRM_URL: z.string().url().default('https://router.project-osrm.org'),
  NOMINATIM_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_CONTACT_EMAIL: z.string().email().default('demo@ai-logist.local'),

  // Phase 5 POLISH-06 — LLM provider failover. Default 'anthropic'; setting to
  // 'openai' swaps in OpenAIAdapter (requires OPENAI_API_KEY). Both adapters
  // share the Phase 2 tool registry — Anti-Pitfall #1 invariant preserved
  // (prices always rendered from leads.quoted_price DB column).
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).optional().default('anthropic'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional().default('gpt-4o'),

  // Phase 3.1 — voice channel config (D-26). All optional at schema level so
  // Phase 2 unit tests + Phase 3 boot without voice config. requireVoiceConfig()
  // throws at the voice plugin/route boundary (same pattern as requireTelegramConfig).
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_SIGNATURE_SECRET: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  ELEVENLABS_WEBHOOK_SECRET: z.string().optional(),
  VOICE_PUBLIC_URL: z.string().url().optional(),

  // Outbound voice confirmation flow (demo § "voice confirmations at A/B").
  // ELEVENLABS_AGENT_ID_CONFIRM — separate agent that handles pickup/delivery
  // confirmation calls AND inbound status queries (branches on
  // dynamic_variables.flow). Falls back to ELEVENLABS_AGENT_ID when unset so
  // existing setups keep working.
  // ELEVENLABS_PHONE_NUMBER_ID — the `phone_number_id` ElevenLabs assigned to
  // the Twilio number when we imported it. Required to dial outbound through
  // `/v1/convai/twilio/outbound-call`.
  // DEMO_CLIENT_PHONE — when set, dialOrderConfirmation uses this E.164 instead
  // of the per-order clients.phone. Lets us point all demo calls at one tester
  // phone without DB writes.
  ELEVENLABS_AGENT_ID_CONFIRM: z.string().optional(),
  ELEVENLABS_PHONE_NUMBER_ID: z.string().optional(),
  DEMO_CLIENT_PHONE: z.string().optional(),

  // Phase 6 — Demo ticker (D-01). Both default-on with sane values; flag
  // gates registration in test/CI envs where Postgres isn't running.
  DEMO_TICKER_ENABLED: z.coerce.boolean().default(false),
  DEMO_TICKER_INTERVAL_SEC: z.coerce.number().int().positive().default(30),
  DEMO_TICKER_DELTA_PCT: z.coerce.number().int().min(1).max(100).default(10),

  // Phase 6 — Stripe Checkout (D-17). All optional at config-parse so the API
  // boots without keys; requireStripeConfig() in apps/api/src/channels/stripe/setup.ts
  // throws at the route boundary (mirrors requireVoiceConfig pattern).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_CURRENCY: z.string().default('rub'),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),

  // Phase 6 — Admin shared-secret (Pitfall 6 mitigation). Optional; routes
  // enforce only when set so dev keeps working without it.
  ADMIN_API_SECRET: z.string().optional(),

  // Build info (passed at docker build time)
  VERSION: z.string().default('dev'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// docker-compose substitutes unset ${VAR} as empty string "". For optional URL
// fields (z.string().url().optional()) an empty string FAILS — `.optional()`
// only short-circuits undefined, not empty. Normalize "" → undefined before
// parsing so any optional field stays absent when the env var is unset.
const normalizedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])
);
const parsed = ConfigSchema.safeParse(normalizedEnv);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config: AppConfig = parsed.data;

/** Phase 5 POLISH-06 — boundary assertion for OpenAI provider swap.
 *  Throws at the first call to getLLMClient() when LLM_PROVIDER=openai but
 *  OPENAI_API_KEY is absent. NOT enforced at config-parse time so the API
 *  boots happily on the default ('anthropic') without needing the OpenAI key.
 */
export function requireOpenAIConfig(): void {
  if (config.LLM_PROVIDER === 'openai' && !config.OPENAI_API_KEY) {
    throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY to be set');
  }
}

/** D-30 / RESEARCH Open Question §1 — boundary assertion for live Telegram channel. */
export function requireTelegramConfig(): void {
  if (
    !config.TELEGRAM_BOT_TOKEN ||
    !config.TELEGRAM_WEBHOOK_SECRET ||
    !config.TELEGRAM_BOT_USERNAME
  ) {
    throw new Error(
      'Telegram channel requires TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET + TELEGRAM_BOT_USERNAME'
    );
  }
}
