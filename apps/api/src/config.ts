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

  // Build info (passed at docker build time)
  VERSION: z.string().default('dev'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config: AppConfig = parsed.data;

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
