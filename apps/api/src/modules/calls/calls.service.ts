import { type CallRecord, type CallState } from '@voice/shared';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { MemoryStore } from '../../store/memory-store.js';
import type { CampaignEngine, LaunchResult } from '../campaigns/campaign-engine.js';
import { CallStateMachine } from './call-state-machine.js';

const CreateStubSchema = z.object({
  campaignId: z.string(),
  contactIds: z.array(z.string()).min(1).optional(),
});

const TransitionSchema = z.object({
  to: z.enum([
    'draft',
    'approved',
    'queued',
    'initiating',
    'ringing',
    'connected',
    'completed',
    'failed',
    'cancelled',
    'opted_out',
  ]),
  outcome: z
    .enum([
      'unknown',
      'completed',
      'no_answer',
      'busy',
      'voicemail',
      'failed',
      'opted_out',
      'escalated',
      'cancelled',
    ])
    .optional(),
  summary: z.string().optional(),
  errorMessage: z.string().optional(),
});

export class CallsService {
  private readonly machine: CallStateMachine;

  constructor(
    private readonly store: MemoryStore,
    private readonly engine: CampaignEngine,
  ) {
    this.machine = engine.getStateMachine();
  }

  list(filters: { status?: CallState; campaignId?: string; q?: string } = {}): CallRecord[] {
    let calls = [...this.store.calls.values()];
    if (filters.status) calls = calls.filter((c) => c.status === filters.status);
    if (filters.campaignId) calls = calls.filter((c) => c.campaignId === filters.campaignId);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      calls = calls.filter((c) => {
        const contact = this.store.contacts.get(c.contactId);
        const campaign = this.store.campaigns.get(c.campaignId);
        return (
          c.id.toLowerCase().includes(q) ||
          (contact?.name.toLowerCase().includes(q) ?? false) ||
          (contact?.phoneE164.includes(q) ?? false) ||
          (campaign?.name.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return calls.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): CallRecord & {
    contactName?: string;
    contactPhone?: string;
    campaignName?: string;
  } {
    const call = this.store.calls.get(id);
    if (!call) throw new NotFoundError('Call not found');
    const contact = this.store.contacts.get(call.contactId);
    const campaign = this.store.campaigns.get(call.campaignId);
    return {
      ...call,
      contactName: contact?.name,
      contactPhone: contact?.phoneE164,
      campaignName: campaign?.name,
    };
  }

  /**
   * Creates / reuses idempotent call jobs and dispatches within concurrency.
   * Alias kept as "stubs" for Phase 2 clients — always simulated unless live verified.
   */
  async createStubsForCampaign(input: unknown): Promise<LaunchResult> {
    const parsed = CreateStubSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid call stub payload', parsed.error.flatten());
    }
    return this.engine.launch(parsed.data.campaignId, {
      contactIds: parsed.data.contactIds,
    });
  }

  async launchCampaign(input: unknown): Promise<LaunchResult> {
    return this.createStubsForCampaign(input);
  }

  transition(callId: string, input: unknown): CallRecord {
    const parsed = TransitionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid transition payload', parsed.error.flatten());
    }
    return this.machine.transition(callId, parsed.data.to, {
      outcome: parsed.data.outcome,
      summary: parsed.data.summary,
      errorMessage: parsed.data.errorMessage,
    });
  }
}
