import type { AppSettings } from '@voice/shared';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import { ValidationError } from '../../lib/errors.js';
import type { MemoryStore } from '../../store/memory-store.js';

const PatchSettingsSchema = z.object({
  telephonyProvider: z.enum(['simulated', 'twilio', 'exotel', 'plivo']).optional(),
  sttProvider: z.enum(['simulated', 'groq', 'deepgram']).optional(),
  ttsProvider: z.enum(['simulated', 'groq', 'twilio', 'elevenlabs']).optional(),
  conversationProvider: z.enum(['simulated', 'groq']).optional(),
  maxConcurrentCalls: z.number().int().positive().max(50).optional(),
  dailyCallSpendLimitUsd: z.number().nonnegative().optional(),
  transcriptRetentionDays: z.number().int().nonnegative().optional(),
  auditRetentionDays: z.number().int().nonnegative().optional(),
  defaultPhoneRegion: z.string().min(2).max(2).optional(),
});

export function settingsFromConfig(config: AppConfig): AppSettings {
  return {
    telephonyProvider: config.TELEPHONY_PROVIDER,
    sttProvider: config.STT_PROVIDER,
    ttsProvider: config.TTS_PROVIDER,
    conversationProvider: config.CONVERSATION_PROVIDER,
    liveCallingEnabled: config.LIVE_CALLING_ENABLED,
    maxConcurrentCalls: config.MAX_CONCURRENT_CALLS,
    dailyCallSpendLimitUsd: config.DAILY_CALL_SPEND_LIMIT_USD,
    transcriptRetentionDays: config.TRANSCRIPT_RETENTION_DAYS,
    auditRetentionDays: config.AUDIT_RETENTION_DAYS,
    defaultPhoneRegion: 'IN',
  };
}

export class SettingsService {
  constructor(
    private readonly store: MemoryStore,
    private readonly config: AppConfig,
  ) {}

  get(): AppSettings & { liveCallingAllowed: boolean; note: string } {
    return {
      ...this.store.settings,
      liveCallingAllowed: this.config.liveCallingAllowed,
      note: 'LIVE_CALLING_ENABLED is controlled by server environment and cannot be toggled from the UI in Phase 2.',
    };
  }

  patch(input: unknown): AppSettings & { liveCallingAllowed: boolean; note: string } {
    const parsed = PatchSettingsSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid settings payload', parsed.error.flatten());
    }

    this.store.settings = {
      ...this.store.settings,
      ...parsed.data,
      // Keep env as source of truth for live calling gate
      liveCallingEnabled: this.config.LIVE_CALLING_ENABLED,
    };

    return this.get();
  }
}
