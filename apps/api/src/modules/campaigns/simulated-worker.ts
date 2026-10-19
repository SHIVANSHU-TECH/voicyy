import type { Logger } from '../../lib/logger.js';
import type { QueueDriver } from '../../queue/types.js';
import type { MemoryStore } from '../../store/memory-store.js';
import { CallStateMachine } from '../calls/call-state-machine.js';
import {
  CALL_JOB_QUEUE,
  CampaignEngine,
  type CallJobPayload,
} from './campaign-engine.js';

/**
 * Phase 3 simulated dial worker — advances initiating calls through the state machine
 * without touching real telephony. Live dialing remains Phase 5.
 */
export function registerSimulatedCallWorker(input: {
  queue: QueueDriver;
  store: MemoryStore;
  engine: CampaignEngine;
  logger: Logger;
}): void {
  const machine = new CallStateMachine(input.store);

  input.queue.registerHandler<CallJobPayload>(CALL_JOB_QUEUE, async (payload) => {
    const call = input.store.calls.get(payload.callId);
    if (!call) {
      input.logger.warn({ callId: payload.callId }, 'Call job missing record');
      return;
    }

    // Only process initiating jobs (dispatch owns queued → initiating).
    if (call.status !== 'initiating') {
      input.logger.debug(
        { callId: call.id, status: call.status },
        'Skipping call job — not initiating',
      );
      return;
    }

    if (call.mode === 'live') {
      // Phase 5 will own live dialing; refuse to pretend.
      machine.transition(call.id, 'failed', {
        outcome: 'failed',
        errorMessage: 'Live dialing is not enabled in Phase 3 (simulated worker only)',
      });
      input.engine.scheduleRetry(call.id);
      return;
    }

    machine.transition(call.id, 'ringing');
    machine.transition(call.id, 'connected');
    machine.transition(call.id, 'completed', {
      outcome: 'completed',
      summary: 'SIMULATED — no real call placed',
      durationSeconds: 1,
      transcriptAppend: [
        {
          role: 'system',
          text: 'Simulated call completed by Phase 3 campaign engine worker.',
          at: new Date().toISOString(),
        },
      ],
    });

    // Free a concurrency slot for the same campaign.
    await input.engine.dispatchAvailable(call.campaignId);
  });
}
