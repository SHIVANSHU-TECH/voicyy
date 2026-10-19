import { describe, expect, it } from 'vitest';
import { createStore } from '../../store/memory-store.js';
import { CallStateMachine } from './call-state-machine.js';

describe('CallStateMachine', () => {
  it('applies legal transitions and rejects illegal ones', () => {
    const store = createStore({
      telephonyProvider: 'simulated',
      sttProvider: 'simulated',
      ttsProvider: 'simulated',
      conversationProvider: 'simulated',
      liveCallingEnabled: false,
      maxConcurrentCalls: 2,
      dailyCallSpendLimitUsd: 0,
      transcriptRetentionDays: 30,
      auditRetentionDays: 90,
      defaultPhoneRegion: 'IN',
    });

    const now = new Date().toISOString();
    store.calls.set('call_1', {
      id: 'call_1',
      campaignId: 'camp_1',
      contactId: 'ct_1',
      status: 'queued',
      outcome: 'unknown',
      mode: 'simulated',
      transcript: [],
      structuredAnswers: {},
      durationSeconds: 0,
      attempt: 1,
      idempotencyKey: 'call:camp_1:ct_1:a1',
      nextRetryAt: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
    });

    const machine = new CallStateMachine(store);
    const initiating = machine.transition('call_1', 'initiating');
    expect(initiating.status).toBe('initiating');
    expect(initiating.startedAt).toBeTruthy();

    expect(() => machine.transition('call_1', 'completed')).toThrow(/Invalid call state/);
    machine.transition('call_1', 'ringing');
    machine.transition('call_1', 'connected');
    const done = machine.transition('call_1', 'completed', {
      outcome: 'completed',
      summary: 'ok',
    });
    expect(done.status).toBe('completed');
    expect(done.endedAt).toBeTruthy();
    expect(machine.countActive()).toBe(0);
  });
});
