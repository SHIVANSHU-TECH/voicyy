import {
  buildCallJobIdempotencyKey,
  type CallRecord,
  type Campaign,
} from '@voice/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import type { QueueDriver } from '../../queue/types.js';
import type { MemoryStore } from '../../store/memory-store.js';
import { CallStateMachine } from '../calls/call-state-machine.js';
import {
  assertCampaignLaunchable,
  assertContactEligible,
  assertWithinSchedule,
  type SkipReason,
} from './eligibility.js';

export const CALL_JOB_QUEUE = 'call-jobs';

export interface CallJobPayload {
  callId: string;
  campaignId: string;
  contactId: string;
  attempt: number;
  mode: 'simulated' | 'live';
}

export interface LaunchSkip {
  contactId: string;
  reason: SkipReason;
}

export interface LaunchResult {
  created: CallRecord[];
  reused: CallRecord[];
  skipped: LaunchSkip[];
  dispatched: CallRecord[];
  mode: 'simulated' | 'live';
}

export class CampaignEngine {
  private readonly machine: CallStateMachine;

  constructor(
    private readonly store: MemoryStore,
    private readonly queue: QueueDriver,
    private readonly logger: Logger,
    private readonly liveCallingAllowed: boolean,
  ) {
    this.machine = new CallStateMachine(store);
  }

  getStateMachine(): CallStateMachine {
    return this.machine;
  }

  private resolveConcurrency(campaign: Campaign): number {
    return campaign.maxConcurrentCalls ?? this.store.settings.maxConcurrentCalls;
  }

  private callMode(): 'simulated' | 'live' {
    return this.liveCallingAllowed ? 'live' : 'simulated';
  }

  /**
   * Create idempotent call jobs for campaign contacts and dispatch within concurrency.
   * Never dials live unless LIVE_CALLING is verified — jobs always carry mode from settings.
   */
  async launch(
    campaignId: string,
    opts: { contactIds?: string[]; now?: Date } = {},
  ): Promise<LaunchResult> {
    const campaign = this.store.campaigns.get(campaignId);
    if (!campaign) throw new NotFoundError('Campaign not found');

    const launchable = assertCampaignLaunchable(campaign);
    if (!launchable.ok) {
      throw new ConflictError(`Campaign cannot launch: ${launchable.reason}`);
    }

    const scheduleOk = assertWithinSchedule(campaign, opts.now ?? new Date());
    if (!scheduleOk.ok) {
      throw new ConflictError('Outside campaign calling schedule', {
        reason: scheduleOk.reason,
        schedule: campaign.schedule,
      });
    }

    const contactIds = opts.contactIds?.length ? opts.contactIds : campaign.contactIds;
    if (contactIds.length === 0) {
      throw new ValidationError('No contacts assigned to this campaign');
    }

    const created: CallRecord[] = [];
    const reused: CallRecord[] = [];
    const skipped: LaunchSkip[] = [];
    const mode = this.callMode();

    for (const contactId of contactIds) {
      const contact = this.store.contacts.get(contactId);
      const eligible = assertContactEligible(campaign, contact);
      if (!eligible.ok) {
        skipped.push({ contactId, reason: eligible.reason! });
        continue;
      }

      if (this.hasOpenJob(campaign.id, contactId)) {
        skipped.push({ contactId, reason: 'already_queued_or_active' });
        continue;
      }

      const attempt = this.nextAttemptNumber(campaign, contactId);
      if (attempt === -1) {
        skipped.push({ contactId, reason: 'already_terminal' });
        continue;
      }
      if (attempt > campaign.maxAttempts) {
        skipped.push({ contactId, reason: 'max_attempts_reached' });
        continue;
      }

      const record = this.createCallRecordIdempotent({
        campaign,
        contactId,
        attempt,
        mode,
      });

      if (record.reused) reused.push(record.call);
      else created.push(record.call);
    }

    const dispatched = await this.dispatchAvailable(campaign.id, opts.now ?? new Date());

    return { created, reused, skipped, dispatched, mode };
  }

  /** Process due retries: create attempt+1 jobs when nextRetryAt has passed. */
  async processRetries(now: Date = new Date()): Promise<CallRecord[]> {
    const created: CallRecord[] = [];
    const due = [...this.store.calls.values()].filter(
      (c) =>
        c.status === 'failed' &&
        c.nextRetryAt &&
        new Date(c.nextRetryAt).getTime() <= now.getTime(),
    );

    for (const failed of due) {
      const campaign = this.store.campaigns.get(failed.campaignId);
      if (!campaign) continue;
      if (!assertCampaignLaunchable(campaign).ok) continue;
      if (!assertWithinSchedule(campaign, now).ok) continue;

      const contact = this.store.contacts.get(failed.contactId);
      if (!assertContactEligible(campaign, contact).ok) continue;

      const nextAttempt = failed.attempt + 1;
      if (nextAttempt > campaign.maxAttempts) {
        this.store.calls.set(failed.id, {
          ...failed,
          nextRetryAt: null,
          errorMessage: failed.errorMessage ?? 'Max attempts reached',
          updatedAt: now.toISOString(),
        });
        continue;
      }

      if (this.hasOpenJob(campaign.id, failed.contactId)) continue;

      const record = this.createCallRecordIdempotent({
        campaign,
        contactId: failed.contactId,
        attempt: nextAttempt,
        mode: this.callMode(),
      });
      if (!record.reused) {
        created.push(record.call);
      }
      // Clear retry marker on the failed parent so we don't loop.
      this.store.calls.set(failed.id, {
        ...failed,
        nextRetryAt: null,
        updatedAt: now.toISOString(),
      });
    }

    for (const campaign of this.store.campaigns.values()) {
      if (campaign.status === 'approved') {
        await this.dispatchAvailable(campaign.id, now);
      }
    }

    return created;
  }

  /**
   * Move queued → initiating for slots under the concurrency cap, then enqueue dial jobs.
   */
  async dispatchAvailable(campaignId: string, now: Date = new Date()): Promise<CallRecord[]> {
    const campaign = this.store.campaigns.get(campaignId);
    if (!campaign) return [];
    if (!assertCampaignLaunchable(campaign).ok) return [];
    if (!assertWithinSchedule(campaign, now).ok) return [];

    const limit = this.resolveConcurrency(campaign);
    let active = this.machine.countActive(campaignId);
    const dispatched: CallRecord[] = [];

    const queued = [...this.store.calls.values()]
      .filter((c) => c.campaignId === campaignId && c.status === 'queued')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const call of queued) {
      if (active >= limit) break;
      const contact = this.store.contacts.get(call.contactId);
      if (!assertContactEligible(campaign, contact).ok) continue;

      const moved = this.machine.transition(call.id, 'initiating');
      await this.enqueueCallJob(moved);
      dispatched.push(moved);
      active += 1;
    }

    return dispatched;
  }

  /** Schedule a retry after failure (next job is attempt+1 via processRetries). */
  scheduleRetry(callId: string): CallRecord {
    const call = this.machine.get(callId);
    if (call.status !== 'failed') {
      throw new ConflictError('Only failed calls can schedule a retry');
    }
    const campaign = this.store.campaigns.get(call.campaignId);
    if (!campaign) throw new NotFoundError('Campaign not found');

    const now = new Date().toISOString();
    if (call.attempt >= campaign.maxAttempts) {
      const capped: CallRecord = {
        ...call,
        nextRetryAt: null,
        errorMessage: call.errorMessage ?? 'Max attempts reached',
        updatedAt: now,
      };
      this.store.calls.set(callId, capped);
      return capped;
    }

    const delayMs = campaign.retryBackoffMinutes * 60_000;
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    const updated: CallRecord = {
      ...call,
      nextRetryAt,
      updatedAt: now,
    };
    this.store.calls.set(callId, updated);
    return updated;
  }

  /** Next attempt number, or -1 when contact already completed / opted out. */
  private nextAttemptNumber(campaign: Campaign, contactId: string): number {
    const related = [...this.store.calls.values()]
      .filter((c) => c.campaignId === campaign.id && c.contactId === contactId)
      .sort((a, b) => b.attempt - a.attempt);
    if (related.length === 0) return 1;
    const latest = related[0]!;
    if (latest.status === 'completed' || latest.status === 'opted_out') return -1;
    if (latest.status === 'failed' || latest.status === 'cancelled') {
      return latest.attempt + 1;
    }
    return latest.attempt;
  }

  private hasOpenJob(campaignId: string, contactId: string): boolean {
    return [...this.store.calls.values()].some(
      (c) =>
        c.campaignId === campaignId &&
        c.contactId === contactId &&
        (c.status === 'queued' ||
          c.status === 'initiating' ||
          c.status === 'ringing' ||
          c.status === 'connected' ||
          c.status === 'draft' ||
          c.status === 'approved'),
    );
  }

  private createCallRecordIdempotent(input: {
    campaign: Campaign;
    contactId: string;
    attempt: number;
    mode: 'simulated' | 'live';
  }): { call: CallRecord; reused: boolean } {
    const idempotencyKey = buildCallJobIdempotencyKey({
      campaignId: input.campaign.id,
      contactId: input.contactId,
      attempt: input.attempt,
    });

    const existing = [...this.store.calls.values()].find(
      (c) => c.idempotencyKey === idempotencyKey,
    );
    if (existing) return { call: existing, reused: true };

    const now = new Date().toISOString();
    const record: CallRecord = {
      id: this.store.newId('call'),
      campaignId: input.campaign.id,
      contactId: input.contactId,
      status: 'queued',
      outcome: 'unknown',
      mode: input.mode,
      summary: undefined,
      transcript: [],
      structuredAnswers: {},
      durationSeconds: 0,
      attempt: input.attempt,
      idempotencyKey,
      nextRetryAt: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
    };
    this.store.calls.set(record.id, record);
    this.logger.info(
      { callId: record.id, idempotencyKey, mode: input.mode },
      'Call job created',
    );
    return { call: record, reused: false };
  }

  private async enqueueCallJob(call: CallRecord): Promise<void> {
    const payload: CallJobPayload = {
      callId: call.id,
      campaignId: call.campaignId,
      contactId: call.contactId,
      attempt: call.attempt,
      mode: call.mode,
    };
    // Queue idempotency uses call record key + status so re-dispatch after initiating is distinct.
    const key = `${call.idempotencyKey}:${call.status}`;
    const result = await this.queue.enqueue(CALL_JOB_QUEUE, key, payload);
    if (result.duplicated) {
      this.logger.debug({ callId: call.id, key }, 'Call job enqueue duplicated');
    }
  }
}
