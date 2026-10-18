/**
 * Deterministic key for call jobs: prevents duplicate enqueue for the same attempt.
 */
export function buildCallJobIdempotencyKey(input: {
  campaignId: string;
  contactId: string;
  attempt: number;
}): string {
  const attempt = Number.isInteger(input.attempt) && input.attempt > 0 ? input.attempt : 1;
  return `call:${input.campaignId}:${input.contactId}:a${attempt}`;
}
