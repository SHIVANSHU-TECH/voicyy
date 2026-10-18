import type { DashboardStats } from '@voice/shared';
import type { AppConfig } from '../../config/env.js';
import type { MemoryStore } from '../../store/memory-store.js';

export class DashboardService {
  constructor(
    private readonly store: MemoryStore,
    private readonly config: AppConfig,
  ) {}

  stats(): DashboardStats {
    const callsByStatus: Record<string, number> = {};
    for (const call of this.store.calls.values()) {
      callsByStatus[call.status] = (callsByStatus[call.status] ?? 0) + 1;
    }

    const campaigns = [...this.store.campaigns.values()];
    const contacts = [...this.store.contacts.values()];

    return {
      contacts: contacts.length,
      campaigns: campaigns.length,
      campaignsApproved: campaigns.filter((c) => c.status === 'approved').length,
      callsTotal: this.store.calls.size,
      callsByStatus,
      suppressedContacts: contacts.filter((c) => c.suppressed).length,
      liveCallingAllowed: this.config.liveCallingAllowed,
    };
  }
}
