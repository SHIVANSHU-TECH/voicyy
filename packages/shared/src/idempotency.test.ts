import { describe, expect, it } from 'vitest';
import { buildCallJobIdempotencyKey } from './idempotency.js';

describe('buildCallJobIdempotencyKey', () => {
  it('is stable for the same inputs', () => {
    const a = buildCallJobIdempotencyKey({
      campaignId: 'camp_1',
      contactId: 'ct_1',
      attempt: 1,
    });
    const b = buildCallJobIdempotencyKey({
      campaignId: 'camp_1',
      contactId: 'ct_1',
      attempt: 1,
    });
    expect(a).toBe(b);
    expect(a).toBe('call:camp_1:ct_1:a1');
  });

  it('differs by attempt', () => {
    const a1 = buildCallJobIdempotencyKey({
      campaignId: 'camp_1',
      contactId: 'ct_1',
      attempt: 1,
    });
    const a2 = buildCallJobIdempotencyKey({
      campaignId: 'camp_1',
      contactId: 'ct_1',
      attempt: 2,
    });
    expect(a1).not.toBe(a2);
  });
});
