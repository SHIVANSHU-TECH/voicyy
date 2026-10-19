import {
  assertTransition,
  canTransition,
  type CallOutcome,
  type CallRecord,
  type CallState,
} from '@voice/shared';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type { MemoryStore } from '../../store/memory-store.js';

export const ACTIVE_CALL_STATES: readonly CallState[] = [
  'initiating',
  'ringing',
  'connected',
] as const;

export interface TransitionPatch {
  outcome?: CallOutcome;
  summary?: string;
  errorMessage?: string;
  durationSeconds?: number;
  nextRetryAt?: string | null;
  transcriptAppend?: CallRecord['transcript'];
  structuredAnswers?: Record<string, string>;
}

/**
 * Deterministic call state machine — all status changes go through here.
 */
export class CallStateMachine {
  constructor(private readonly store: MemoryStore) {}

  get(callId: string): CallRecord {
    const call = this.store.calls.get(callId);
    if (!call) throw new NotFoundError('Call not found');
    return call;
  }

  can(from: CallState, to: CallState): boolean {
    return canTransition(from, to);
  }

  transition(callId: string, to: CallState, patch: TransitionPatch = {}): CallRecord {
    const current = this.get(callId);
    try {
      assertTransition(current.status, to);
    } catch {
      throw new ConflictError(`Invalid call state transition: ${current.status} → ${to}`);
    }

    const now = new Date().toISOString();
    const updated: CallRecord = {
      ...current,
      status: to,
      outcome: patch.outcome ?? current.outcome,
      summary: patch.summary ?? current.summary,
      errorMessage: patch.errorMessage ?? current.errorMessage,
      durationSeconds: patch.durationSeconds ?? current.durationSeconds,
      nextRetryAt:
        patch.nextRetryAt !== undefined ? patch.nextRetryAt : current.nextRetryAt,
      structuredAnswers: patch.structuredAnswers ?? current.structuredAnswers,
      transcript: patch.transcriptAppend
        ? [...current.transcript, ...patch.transcriptAppend]
        : current.transcript,
      updatedAt: now,
      startedAt:
        current.startedAt ??
        (to === 'initiating' || to === 'ringing' || to === 'connected' ? now : current.startedAt),
      endedAt:
        to === 'completed' || to === 'failed' || to === 'cancelled' || to === 'opted_out'
          ? now
          : current.endedAt,
    };

    this.store.calls.set(callId, updated);
    return updated;
  }

  countActive(campaignId?: string): number {
    return [...this.store.calls.values()].filter((c) => {
      if (!ACTIVE_CALL_STATES.includes(c.status)) return false;
      if (campaignId && c.campaignId !== campaignId) return false;
      return true;
    }).length;
  }
}
