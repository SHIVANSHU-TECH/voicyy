import { z } from 'zod';

/** Initial call lifecycle states for the campaign engine. */
export const CallStateSchema = z.enum([
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

export type CallState = z.infer<typeof CallStateSchema>;

export const CALL_STATES = CallStateSchema.options;

/** Allowed transitions for the deterministic state machine (Phase 3 expands usage). */
export const CALL_STATE_TRANSITIONS: Record<CallState, readonly CallState[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['initiating', 'cancelled'],
  initiating: ['ringing', 'failed', 'cancelled'],
  ringing: ['connected', 'failed', 'cancelled', 'opted_out'],
  connected: ['completed', 'failed', 'cancelled', 'opted_out'],
  completed: [],
  failed: ['queued'],
  cancelled: [],
  opted_out: [],
};

export function canTransition(from: CallState, to: CallState): boolean {
  return CALL_STATE_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CallState, to: CallState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid call state transition: ${from} → ${to}`);
  }
}
