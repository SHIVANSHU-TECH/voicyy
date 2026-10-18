import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, CALL_STATES } from './call-states.js';

describe('call state machine', () => {
  it('exposes the Phase 1 initial states', () => {
    expect(CALL_STATES).toEqual([
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
    ]);
  });

  it('allows draft → approved and rejects draft → connected', () => {
    expect(canTransition('draft', 'approved')).toBe(true);
    expect(canTransition('draft', 'connected')).toBe(false);
  });

  it('allows connected → opted_out and treats opted_out as terminal', () => {
    expect(canTransition('connected', 'opted_out')).toBe(true);
    expect(canTransition('opted_out', 'queued')).toBe(false);
  });

  it('throws on illegal transitions', () => {
    expect(() => assertTransition('completed', 'queued')).toThrow(/Invalid call state transition/);
  });
});
