import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv, resetConfigCache } from '../../config/env.js';
import { MemoryQueueDriver } from '../../queue/memory-queue.js';
import { createStore } from '../../store/memory-store.js';
import { settingsFromConfig } from '../settings/settings.service.js';

describe('contacts ingestion', () => {
  const logger = pino({ level: 'silent' });
  const queue = new MemoryQueueDriver(logger);
  resetConfigCache();
  const config = loadEnv();

  beforeEach(async () => {
    await queue.start();
  });

  function appWithFreshStore() {
    return createApp({
      config,
      logger,
      queue,
      store: createStore(settingsFromConfig(config)),
    });
  }

  it('previews CSV with valid, invalid, and duplicate rows; requires confirm to save', async () => {
    const app = appWithFreshStore();
    const csv = [
      'name,phone,email',
      'Alice,9876543210,alice@example.com',
      'Bad,,',
      'Bob,9876543210,bob@example.com',
      'Carol,9123456789,carol@example.com',
    ].join('\n');

    const previewRes = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(csv), 'contacts.csv');

    expect(previewRes.status).toBe(201);
    expect(previewRes.body.requiresConfirmation).toBe(true);
    expect(previewRes.body.summary.valid).toBe(2);
    expect(previewRes.body.summary.invalid).toBeGreaterThanOrEqual(2);

    const listBefore = await request(app).get('/api/v1/contacts');
    expect(listBefore.body.contacts).toHaveLength(0);

    const validIndexes = previewRes.body.rows
      .filter((r: { valid: boolean }) => r.valid)
      .map((r: { rowIndex: number }) => r.rowIndex);

    const confirmRes = await request(app)
      .post('/api/v1/contacts/confirm')
      .send({
        previewId: previewRes.body.previewId,
        rowIndexes: validIndexes,
        corrections: validIndexes.map((rowIndex: number) => ({
          rowIndex,
          consentCaptured: true,
        })),
      });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.savedCount).toBe(2);

    const listAfter = await request(app).get('/api/v1/contacts');
    expect(listAfter.body.contacts).toHaveLength(2);
    const phones = listAfter.body.contacts.map((c: { phoneE164: string }) => c.phoneE164).sort();
    expect(phones).toEqual(['+919123456789', '+919876543210']);
  });

  it('detects duplicates against existing contacts', async () => {
    const app = appWithFreshStore();
    const first = ['name,phone', 'Alice,9876543210'].join('\n');

    const preview1 = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(first), 'a.csv');
    await request(app)
      .post('/api/v1/contacts/confirm')
      .send({ previewId: preview1.body.previewId, rowIndexes: [2] });

    const preview2 = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(first), 'b.csv');

    expect(preview2.body.rows[0].duplicateOfContactId).toBeTruthy();
    expect(preview2.body.rows[0].valid).toBe(false);
  });
});
