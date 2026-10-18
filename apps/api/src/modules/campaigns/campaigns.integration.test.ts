import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv, resetConfigCache } from '../../config/env.js';
import { MemoryQueueDriver } from '../../queue/memory-queue.js';
import { createStore } from '../../store/memory-store.js';
import { settingsFromConfig } from '../settings/settings.service.js';

describe('campaigns and call stubs', () => {
  const logger = pino({ level: 'silent' });
  const queue = new MemoryQueueDriver(logger);
  resetConfigCache();
  const config = loadEnv();
  const store = createStore(settingsFromConfig(config));
  const app = createApp({ config, logger, queue, store });

  it('creates campaign, approves script, queues simulated call stubs', async () => {
    await queue.start();

    const csv = 'name,phone\nAlice,9876543210\n';
    const preview = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(csv), 'c.csv');
    const confirm = await request(app)
      .post('/api/v1/contacts/confirm')
      .send({ previewId: preview.body.previewId, rowIndexes: [2] });
    const contactId = confirm.body.contacts[0].id as string;

    const created = await request(app)
      .post('/api/v1/campaigns')
      .send({
        name: 'Demo outreach',
        goal: 'Qualify interest',
        script: 'Hello, this is a scripted outreach call.',
        openingMessage: 'Hi, do you have a moment?',
        closingMessage: 'Thanks for your time.',
        approvedFacts: ['We never invent pricing'],
        forbiddenClaims: ['Guaranteed returns'],
        contactIds: [contactId],
      });
    expect(created.status).toBe(201);
    expect(created.body.campaign.scriptApproved).toBe(false);

    const campaignId = created.body.campaign.id as string;
    const approved = await request(app).post(`/api/v1/campaigns/${campaignId}/approve-script`);
    expect(approved.status).toBe(200);
    expect(approved.body.campaign.status).toBe('approved');

    const stubs = await request(app).post('/api/v1/calls/stubs').send({ campaignId });
    expect(stubs.status).toBe(201);
    expect(stubs.body.mode).toBe('simulated');
    expect(stubs.body.calls[0].status).toBe('queued');
    expect(stubs.body.calls[0].mode).toBe('simulated');

    const again = await request(app).post('/api/v1/calls/stubs').send({ campaignId });
    expect(again.body.calls[0].id).toBe(stubs.body.calls[0].id);

    const stats = await request(app).get('/api/v1/dashboard/stats');
    expect(stats.body.stats.contacts).toBe(1);
    expect(stats.body.stats.campaignsApproved).toBe(1);
    expect(stats.body.stats.callsTotal).toBe(1);
  });
});
