import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv, resetConfigCache } from '../../config/env.js';
import { MemoryQueueDriver } from '../../queue/memory-queue.js';
import { createStore } from '../../store/memory-store.js';
import { settingsFromConfig } from '../settings/settings.service.js';

describe('Phase 3 campaign engine', () => {
  const logger = pino({ level: 'silent' });

  async function setup() {
    const queue = new MemoryQueueDriver(logger);
    resetConfigCache();
    const config = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      LIVE_CALLING_ENABLED: 'false',
      MAX_CONCURRENT_CALLS: '1',
      QUEUE_MODE: 'memory',
    });
    const store = createStore(settingsFromConfig(config));
    await queue.start();
    const app = createApp({ config, logger, queue, store });
    return { app, queue, store, config };
  }

  async function importConsentedContact(app: ReturnType<typeof createApp>) {
    const csv = 'name,phone\nAlice,9876543210\n';
    const preview = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(csv), 'c.csv');
    const confirm = await request(app)
      .post('/api/v1/contacts/confirm')
      .send({
        previewId: preview.body.previewId,
        rowIndexes: [2],
        corrections: [{ rowIndex: 2, consentCaptured: true }],
      });
    return confirm.body.contacts[0].id as string;
  }

  it('creates campaign with Q&A / facts / schedule, launches idempotently, simulates completion', async () => {
    const { app, queue } = await setup();

    const contactId = await importConsentedContact(app);

    const created = await request(app)
      .post('/api/v1/campaigns')
      .send({
        name: 'Demo outreach',
        goal: 'Qualify interest',
        script: 'Hello, this is a scripted outreach call.',
        openingMessage: 'Hi, do you have a moment?',
        closingMessage: 'Thanks for your time.',
        questions: ['Are you the decision maker?'],
        qualificationCriteria: ['Interested in a demo'],
        approvedFacts: ['We never invent pricing'],
        forbiddenClaims: ['Guaranteed returns'],
        schedule: {
          timezone: 'UTC',
          windowStartLocal: '',
          windowEndLocal: '',
          daysOfWeek: [],
        },
        maxAttempts: 3,
        retryBackoffMinutes: 0,
        maxConcurrentCalls: 1,
        requireConsent: true,
        contactIds: [contactId],
      });
    expect(created.status).toBe(201);
    expect(created.body.campaign.questions).toEqual(['Are you the decision maker?']);
    expect(created.body.campaign.approvedFacts).toContain('We never invent pricing');
    expect(created.body.campaign.forbiddenClaims).toContain('Guaranteed returns');
    expect(created.body.campaign.requireConsent).toBe(true);

    const campaignId = created.body.campaign.id as string;
    const approved = await request(app).post(`/api/v1/campaigns/${campaignId}/approve-script`);
    expect(approved.status).toBe(200);
    expect(approved.body.campaign.status).toBe('approved');

    const launch = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    expect(launch.status).toBe(201);
    expect(launch.body.mode).toBe('simulated');
    expect(launch.body.created).toHaveLength(1);
    expect(launch.body.dispatched).toHaveLength(1);
    expect(launch.body.dispatched[0].status).toBe('initiating');

    await queue.flush();

    const calls = await request(app).get(`/api/v1/calls?campaignId=${campaignId}`);
    expect(calls.body.calls).toHaveLength(1);
    expect(calls.body.calls[0].status).toBe('completed');
    expect(calls.body.calls[0].mode).toBe('simulated');
    expect(calls.body.calls[0].summary).toMatch(/SIMULATED/);

    const again = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    expect(again.status).toBe(201);
    // Completed contact is not re-queued
    expect(again.body.created).toHaveLength(0);
    expect(again.body.skipped[0].reason).toBe('already_terminal');

    const stubs = await request(app).post('/api/v1/calls/stubs').send({ campaignId });
    expect(stubs.status).toBe(201);
    expect(stubs.body.calls).toHaveLength(0);

    const stats = await request(app).get('/api/v1/dashboard/stats');
    expect(stats.body.stats.contacts).toBe(1);
    expect(stats.body.stats.campaignsApproved).toBe(1);
    expect(stats.body.stats.callsTotal).toBe(1);

    await queue.stop();
  });

  it('blocks launch without consent and when suppressed', async () => {
    const { app, queue, store } = await setup();

    const csv = 'name,phone\nBob,9876543211\n';
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
        name: 'Consent gate',
        goal: 'Test',
        script: 'Script',
        contactIds: [contactId],
        requireConsent: true,
      });
    const campaignId = created.body.campaign.id as string;
    await request(app).post(`/api/v1/campaigns/${campaignId}/approve-script`);

    const blocked = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    expect(blocked.status).toBe(201);
    expect(blocked.body.created).toHaveLength(0);
    expect(blocked.body.skipped[0].reason).toBe('consent_required');

    const contact = store.contacts.get(contactId)!;
    store.contacts.set(contactId, { ...contact, consentCaptured: true, suppressed: true });

    const suppressed = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    expect(suppressed.body.skipped[0].reason).toBe('contact_suppressed');

    await queue.stop();
  });

  it('rejects illegal state transitions', async () => {
    const { app, queue } = await setup();
    const contactId = await importConsentedContact(app);
    const created = await request(app)
      .post('/api/v1/campaigns')
      .send({
        name: 'SM',
        goal: 'g',
        script: 's',
        contactIds: [contactId],
        maxConcurrentCalls: 2,
      });
    const campaignId = created.body.campaign.id as string;
    await request(app).post(`/api/v1/campaigns/${campaignId}/approve-script`);
    const launch = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    const callId = launch.body.created[0].id as string;

    // Immediately try illegal jump before worker finishes — may already be completed.
    await queue.flush();
    const completed = await request(app).get(`/api/v1/calls/${callId}`);
    expect(completed.body.call.status).toBe('completed');

    const bad = await request(app)
      .post(`/api/v1/calls/${callId}/transition`)
      .send({ to: 'queued' });
    expect(bad.status).toBe(409);

    await queue.stop();
  });

  it('pauses campaign so dispatch stops', async () => {
    const { app, queue, store } = await setup();
    const contactId = await importConsentedContact(app);
    // Second contact
    const csv = 'name,phone\nCara,9876543212\n';
    const preview = await request(app)
      .post('/api/v1/contacts/preview')
      .attach('file', Buffer.from(csv), 'c2.csv');
    const confirm = await request(app)
      .post('/api/v1/contacts/confirm')
      .send({
        previewId: preview.body.previewId,
        rowIndexes: [2],
        corrections: [{ rowIndex: 2, consentCaptured: true }],
      });
    const contactId2 = confirm.body.contacts[0].id as string;

    const created = await request(app)
      .post('/api/v1/campaigns')
      .send({
        name: 'Pause test',
        goal: 'g',
        script: 's',
        contactIds: [contactId, contactId2],
        maxConcurrentCalls: 1,
      });
    const campaignId = created.body.campaign.id as string;
    await request(app).post(`/api/v1/campaigns/${campaignId}/approve-script`);

    // Create jobs without letting worker run by pausing mid-flight is hard;
    // instead create records via launch then pause and ensure no further dispatch.
    const launch = await request(app).post(`/api/v1/campaigns/${campaignId}/launch`);
    expect(launch.body.dispatched).toHaveLength(1);
    // One may still be queued due to concurrency=1
    const queuedBefore = [...store.calls.values()].filter((c) => c.status === 'queued');
    expect(queuedBefore.length + launch.body.dispatched.length).toBeGreaterThanOrEqual(1);

    const paused = await request(app).post(`/api/v1/campaigns/${campaignId}/pause`);
    expect(paused.body.campaign.status).toBe('paused');

    const dispatch = await request(app).post(`/api/v1/campaigns/${campaignId}/dispatch`);
    expect(dispatch.body.dispatched).toHaveLength(0);

    await queue.flush();
    await queue.stop();
  });
});
