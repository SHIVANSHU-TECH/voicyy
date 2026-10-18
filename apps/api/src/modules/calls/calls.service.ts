import { buildCallJobIdempotencyKey, type CallRecord, type CallState } from '@voice/shared';
import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { MemoryStore } from '../../store/memory-store.js';

const CreateStubSchema = z.object({
  campaignId: z.string(),
  contactIds: z.array(z.string()).min(1).optional(),
});

export class CallsService {
  constructor(private readonly store: MemoryStore) {}

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
   * Creates non-dialing call stubs for an approved campaign.
   * Never initiates live telephony — stubs are always mode=simulated.
   */
  createStubsForCampaign(input: unknown): CallRecord[] {
    const parsed = CreateStubSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid call stub payload', parsed.error.flatten());
    }

    const campaign = this.store.campaigns.get(parsed.data.campaignId);
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (!campaign.scriptApproved || campaign.status !== 'approved') {
      throw new ConflictError('Campaign script must be approved before queueing calls');
    }

    const contactIds = parsed.data.contactIds?.length
      ? parsed.data.contactIds
      : campaign.contactIds;

    if (contactIds.length === 0) {
      throw new ValidationError('No contacts assigned to this campaign');
    }

    const created: CallRecord[] = [];
    for (const contactId of contactIds) {
      const contact = this.store.contacts.get(contactId);
      if (!contact) throw new ValidationError(`Unknown contact: ${contactId}`);
      if (contact.suppressed) {
        throw new ConflictError(`Contact ${contactId} is suppressed / opted out`);
      }

      const attempt = 1;
      const idempotencyKey = buildCallJobIdempotencyKey({
        campaignId: campaign.id,
        contactId,
        attempt,
      });

      const existing = [...this.store.calls.values()].find(
        (c) => c.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        created.push(existing);
        continue;
      }

      const now = new Date().toISOString();
      const record: CallRecord = {
        id: this.store.newId('call'),
        campaignId: campaign.id,
        contactId,
        status: 'queued',
        outcome: 'unknown',
        mode: 'simulated',
        summary: undefined,
        transcript: [],
        structuredAnswers: {},
        durationSeconds: 0,
        attempt,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        endedAt: null,
      };
      this.store.calls.set(record.id, record);
      created.push(record);
    }

    return created;
  }
}
