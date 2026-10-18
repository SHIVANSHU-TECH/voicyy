import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadEnv, resetConfigCache } from './config/env.js';
import { MemoryQueueDriver } from './queue/memory-queue.js';

describe('API foundation', () => {
  const logger = pino({ level: 'silent' });
  const queue = new MemoryQueueDriver(logger);
  let config = loadEnv();

  beforeAll(async () => {
    resetConfigCache();
    config = loadEnv();
    await queue.start();
  });

  afterAll(async () => {
    await queue.stop();
  });

  it('GET /health returns ok', async () => {
    const app = createApp({ config, logger, queue });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /ready reports memory queue and live calling disabled', async () => {
    const app = createApp({ config, logger, queue });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.queueDriver).toBe('memory');
    expect(res.body.liveCallingAllowed).toBe(false);
  });

  it('GET /api/v1/meta does not leak secrets', async () => {
    const app = createApp({ config, logger, queue });
    const res = await request(app).get('/api/v1/meta');
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(2);
    expect(res.body.config.providers.telephony).toBe('simulated');
    expect(JSON.stringify(res.body)).not.toMatch(/GROQ_API_KEY|AUTH_TOKEN|apiKey/i);
  });

  it('unknown routes return structured 404', async () => {
    const app = createApp({ config, logger, queue });
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
});
