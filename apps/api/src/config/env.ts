import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  ConversationProviderNameSchema,
  SttProviderNameSchema,
  TelephonyProviderNameSchema,
  TtsProviderNameSchema,
} from '@voice/shared';

const boolFromEnv = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === 'boolean') return value;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  throw new Error(`Invalid boolean: ${value}`);
});

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(4100),
    CORS_ORIGIN: z.string().default('http://localhost:3100'),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    QUEUE_MODE: z.enum(['auto', 'redis', 'memory']).default('auto'),
    LIVE_CALLING_ENABLED: boolFromEnv.default(false),
    MAX_CONCURRENT_CALLS: z.coerce.number().int().positive().default(2),
    DAILY_CALL_SPEND_LIMIT_USD: z.coerce.number().nonnegative().default(0),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
    TELEPHONY_PROVIDER: TelephonyProviderNameSchema.default('simulated'),
    STT_PROVIDER: SttProviderNameSchema.default('simulated'),
    TTS_PROVIDER: TtsProviderNameSchema.default('simulated'),
    CONVERSATION_PROVIDER: ConversationProviderNameSchema.default('simulated'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    EXOTEL_API_KEY: z.string().optional(),
    EXOTEL_API_TOKEN: z.string().optional(),
    EXOTEL_SID: z.string().optional(),
    EXOTEL_SUBDOMAIN: z.string().optional(),
    TRANSCRIPT_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(30),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(90),
  })
  .superRefine((env, ctx) => {
    if (env.LIVE_CALLING_ENABLED && env.TELEPHONY_PROVIDER === 'simulated') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LIVE_CALLING_ENABLED'],
        message:
          'LIVE_CALLING_ENABLED cannot be true while TELEPHONY_PROVIDER=simulated. Verify a real provider first.',
      });
    }

    if (env.QUEUE_MODE === 'redis' && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when QUEUE_MODE=redis',
      });
    }

    if (
      env.CONVERSATION_PROVIDER === 'groq' &&
      !env.GROQ_API_KEY &&
      env.NODE_ENV === 'production'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GROQ_API_KEY'],
        message: 'GROQ_API_KEY is required in production when CONVERSATION_PROVIDER=groq',
      });
    }
  });

export type AppConfig = z.infer<typeof EnvSchema> & {
  queueDriver: 'memory' | 'redis';
  liveCallingAllowed: boolean;
};

let cachedConfig: AppConfig | null = null;

function resolveQueueDriver(env: z.infer<typeof EnvSchema>): 'memory' | 'redis' {
  if (env.QUEUE_MODE === 'memory') return 'memory';
  if (env.QUEUE_MODE === 'redis') return 'redis';
  return env.REDIS_URL ? 'redis' : 'memory';
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Load monorepo root .env when present (apps/api may be started from nested cwd).
  loadDotenv({ path: resolve(process.cwd(), '../../.env') });
  loadDotenv({ path: resolve(process.cwd(), '.env') });

  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const queueDriver = resolveQueueDriver(parsed.data);
  return {
    ...parsed.data,
    queueDriver,
    liveCallingAllowed:
      parsed.data.LIVE_CALLING_ENABLED && parsed.data.TELEPHONY_PROVIDER !== 'simulated',
  };
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnv();
  }
  return cachedConfig;
}

/** Test helper — clears memoized config. */
export function resetConfigCache(): void {
  cachedConfig = null;
}

export function publicConfigView(config: AppConfig) {
  return {
    nodeEnv: config.NODE_ENV,
    liveCallingEnabled: config.LIVE_CALLING_ENABLED,
    liveCallingAllowed: config.liveCallingAllowed,
    maxConcurrentCalls: config.MAX_CONCURRENT_CALLS,
    dailyCallSpendLimitUsd: config.DAILY_CALL_SPEND_LIMIT_USD,
    queueDriver: config.queueDriver,
    queueMode: config.QUEUE_MODE,
    providers: {
      telephony: config.TELEPHONY_PROVIDER,
      stt: config.STT_PROVIDER,
      tts: config.TTS_PROVIDER,
      conversation: config.CONVERSATION_PROVIDER,
    },
    retentionDays: {
      transcripts: config.TRANSCRIPT_RETENTION_DAYS,
      audit: config.AUDIT_RETENTION_DAYS,
    },
    databaseConfigured: Boolean(config.DATABASE_URL),
    redisConfigured: Boolean(config.REDIS_URL),
    groqConfigured: Boolean(config.GROQ_API_KEY),
  };
}
