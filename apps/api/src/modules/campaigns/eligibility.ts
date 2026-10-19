import { isWithinSchedule, type Campaign, type Contact } from '@voice/shared';

export type SkipReason =
  | 'campaign_not_approved'
  | 'campaign_paused'
  | 'campaign_archived'
  | 'outside_schedule'
  | 'contact_missing'
  | 'contact_suppressed'
  | 'consent_required'
  | 'concurrency_limit'
  | 'max_attempts_reached'
  | 'already_terminal'
  | 'already_queued_or_active';

export interface EligibilityResult {
  ok: boolean;
  reason?: SkipReason;
}

export function assertCampaignLaunchable(campaign: Campaign): EligibilityResult {
  if (campaign.status === 'archived') {
    return { ok: false, reason: 'campaign_archived' };
  }
  if (campaign.status === 'paused') {
    return { ok: false, reason: 'campaign_paused' };
  }
  if (!campaign.scriptApproved || campaign.status !== 'approved') {
    return { ok: false, reason: 'campaign_not_approved' };
  }
  return { ok: true };
}

export function assertWithinSchedule(
  campaign: Campaign,
  now: Date = new Date(),
): EligibilityResult {
  if (!isWithinSchedule(campaign.schedule, now)) {
    return { ok: false, reason: 'outside_schedule' };
  }
  return { ok: true };
}

export function assertContactEligible(
  campaign: Campaign,
  contact: Contact | undefined,
): EligibilityResult {
  if (!contact) return { ok: false, reason: 'contact_missing' };
  if (contact.suppressed) return { ok: false, reason: 'contact_suppressed' };
  if (campaign.requireConsent && !contact.consentCaptured) {
    return { ok: false, reason: 'consent_required' };
  }
  return { ok: true };
}
