import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv, publicConfigView, resetConfigCache } from './env.js';

const baseEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  API_HOST: '127.0.0.1',
  API_PORT: '4100',
  CORS_ORIGIN: 'http://localhost:3100',
  QUEUE_MODE: 'memory',
  LIVE_CALLING_ENABLED: 'false',
  MAX_CONCURRENT_CALLS: '2',
  DAILY_CALL_SPEND_LIMIT_USD: '0',
  TELEPHONY_PROVIDER: 'simulated',
  STT_PROVIDER: 'simulated',
  TTS_PROVIDER: 'simulated',
  CONVERSATION_PROVIDER: 'simulated',
  GROQ_MODEL: 'llama-3.1-8b-instant',
  TRANSCRIPT_RETENTION_DAYS: '30',
  AUDIT_RETENTION_DAYS: '90',
} as NodeJS.ProcessEnv;

afterEach(() => {
  resetConfigCache();
});

describe('loadEnv', () => {
  it('loads defaults and selects memory queue without Redis', () => {
    const config = loadEnv({ ...baseEnv });
    expect(config.queueDriver).toBe('memory');
    expect(config.liveCallingAllowed).toBe(false);
    expect(config.API_PORT).toBe(4100);
  });

  it('rejects live calling with simulated telephony', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        LIVE_CALLING_ENABLED: 'true',
        TELEPHONY_PROVIDER: 'simulated',
      }),
    ).toThrow(/LIVE_CALLING_ENABLED/);
  });

  it('requires REDIS_URL when QUEUE_MODE=redis', () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        QUEUE_MODE: 'redis',
      }),
    ).toThrow(/REDIS_URL/);
  });

  it('never exposes secrets in publicConfigView', () => {
    const config = loadEnv({
      ...baseEnv,
      GROQ_API_KEY: 'secret-key-value',
      TWILIO_AUTH_TOKEN: 'twilio-secret',
    });
    const view = publicConfigView(config);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('secret-key-value');
    expect(serialized).not.toContain('twilio-secret');
    expect(view.groqConfigured).toBe(true);
  });
});
