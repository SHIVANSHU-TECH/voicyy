import type { Campaign, CampaignSchedule } from '@voice/shared';
import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { MemoryStore } from '../../store/memory-store.js';

const ScheduleInputSchema = z
  .object({
    timezone: z.string().default('Asia/Kolkata'),
    windowStartLocal: z.string().default(''),
    windowEndLocal: z.string().default(''),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  })
  .default({
    timezone: 'Asia/Kolkata',
    windowStartLocal: '',
    windowEndLocal: '',
    daysOfWeek: [],
  });

const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  goal: z.string().min(1),
  language: z.string().default('en-IN'),
  openingMessage: z.string().default(''),
  closingMessage: z.string().default(''),
  script: z.string().min(1),
  questions: z.array(z.string()).default([]),
  qualificationCriteria: z.array(z.string()).default([]),
  approvedFacts: z.array(z.string()).default([]),
  forbiddenClaims: z.array(z.string()).default([]),
  contactIds: z.array(z.string()).default([]),
  schedule: ScheduleInputSchema,
  maxAttempts: z.number().int().positive().default(3),
  retryBackoffMinutes: z.number().int().nonnegative().default(30),
  maxConcurrentCalls: z.number().int().positive().nullable().default(null),
  requireConsent: z.boolean().default(true),
});

const UpdateCampaignSchema = CreateCampaignSchema.partial();

function normalizeSchedule(schedule: z.infer<typeof ScheduleInputSchema>): CampaignSchedule {
  return {
    timezone: schedule.timezone || 'Asia/Kolkata',
    windowStartLocal: schedule.windowStartLocal ?? '',
    windowEndLocal: schedule.windowEndLocal ?? '',
    daysOfWeek: schedule.daysOfWeek ?? [],
  };
}

export class CampaignsService {
  constructor(private readonly store: MemoryStore) {}

  list(): Campaign[] {
    return [...this.store.campaigns.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  get(id: string): Campaign {
    const campaign = this.store.campaigns.get(id);
    if (!campaign) throw new NotFoundError('Campaign not found');
    return campaign;
  }

  create(input: unknown): Campaign {
    const parsed = CreateCampaignSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid campaign payload', parsed.error.flatten());
    }

    this.assertContactsExist(parsed.data.contactIds);
    const now = new Date().toISOString();
    const { schedule, ...rest } = parsed.data;
    const campaign: Campaign = {
      id: this.store.newId('camp'),
      ...rest,
      schedule: normalizeSchedule(schedule),
      scriptApproved: false,
      scriptApprovedAt: null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.store.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  update(id: string, input: unknown): Campaign {
    const existing = this.get(id);
    if (existing.status === 'archived') {
      throw new ConflictError('Archived campaigns cannot be edited');
    }

    const parsed = UpdateCampaignSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid campaign update', parsed.error.flatten());
    }

    if (parsed.data.contactIds) this.assertContactsExist(parsed.data.contactIds);

    const scriptChanged =
      parsed.data.script !== undefined && parsed.data.script !== existing.script;

    const { schedule, ...rest } = parsed.data;
    const updated: Campaign = {
      ...existing,
      ...rest,
      schedule: schedule ? normalizeSchedule(schedule) : existing.schedule,
      scriptApproved: scriptChanged ? false : existing.scriptApproved,
      scriptApprovedAt: scriptChanged ? null : existing.scriptApprovedAt,
      status: scriptChanged && existing.status === 'approved' ? 'draft' : existing.status,
      updatedAt: new Date().toISOString(),
    };

    this.store.campaigns.set(id, updated);
    return updated;
  }

  submitForApproval(id: string): Campaign {
    const campaign = this.get(id);
    if (!campaign.script.trim()) {
      throw new ValidationError('Script is required before approval');
    }
    const updated: Campaign = {
      ...campaign,
      status: 'pending_approval',
      updatedAt: new Date().toISOString(),
    };
    this.store.campaigns.set(id, updated);
    return updated;
  }

  approveScript(id: string): Campaign {
    const campaign = this.get(id);
    if (!campaign.script.trim()) {
      throw new ValidationError('Cannot approve an empty script');
    }
    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      scriptApproved: true,
      scriptApprovedAt: now,
      status: 'approved',
      updatedAt: now,
    };
    this.store.campaigns.set(id, updated);
    return updated;
  }

  pause(id: string): Campaign {
    const campaign = this.get(id);
    if (campaign.status === 'archived') {
      throw new ConflictError('Archived campaigns cannot be paused');
    }
    if (!campaign.scriptApproved) {
      throw new ConflictError('Only approved campaigns can be paused');
    }
    const updated: Campaign = {
      ...campaign,
      status: 'paused',
      updatedAt: new Date().toISOString(),
    };
    this.store.campaigns.set(id, updated);
    return updated;
  }

  resume(id: string): Campaign {
    const campaign = this.get(id);
    if (campaign.status !== 'paused') {
      throw new ConflictError('Only paused campaigns can be resumed');
    }
    const updated: Campaign = {
      ...campaign,
      status: 'approved',
      updatedAt: new Date().toISOString(),
    };
    this.store.campaigns.set(id, updated);
    return updated;
  }

  private assertContactsExist(ids: string[]): void {
    for (const id of ids) {
      if (!this.store.contacts.has(id)) {
        throw new ValidationError(`Unknown contact id: ${id}`);
      }
    }
  }
}
