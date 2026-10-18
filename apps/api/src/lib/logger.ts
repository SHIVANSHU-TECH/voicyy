import pino from 'pino';
import type { AppConfig } from '../config/env.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.apiKey',
  '*.api_key',
  '*.password',
  '*.token',
  '*.authToken',
  '*.GROQ_API_KEY',
  '*.TWILIO_AUTH_TOKEN',
  '*.EXOTEL_API_TOKEN',
];

export function createLogger(config: AppConfig) {
  const isDev = config.NODE_ENV === 'development';

  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[Redacted]',
    },
    transport:
      isDev && config.LOG_LEVEL !== 'silent'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          }
        : undefined,
    base: {
      service: 'voice-api',
      env: config.NODE_ENV,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
