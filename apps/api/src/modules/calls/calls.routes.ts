import type { CallState } from '@voice/shared';
import { CallStateSchema } from '@voice/shared';
import { Router } from 'express';
import { ValidationError } from '../../lib/errors.js';
import type { CallsService } from './calls.service.js';

export function createCallsRouter(service: CallsService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    let status: CallState | undefined;
    if (typeof req.query.status === 'string' && req.query.status.length > 0) {
      const parsed = CallStateSchema.safeParse(req.query.status);
      if (!parsed.success) throw new ValidationError('Invalid status filter');
      status = parsed.data;
    }
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ calls: service.list({ status, campaignId, q }) });
  });

  router.get('/:id', (req, res) => {
    res.json({ call: service.get(String(req.params.id)) });
  });

  router.post('/stubs', async (req, res) => {
    const result = await service.createStubsForCampaign(req.body);
    const calls = [...result.created, ...result.reused];
    res.status(201).json({
      calls,
      created: result.created,
      reused: result.reused,
      skipped: result.skipped,
      dispatched: result.dispatched,
      mode: result.mode,
      warning: 'NOT_A_REAL_CALL — stubs only; live dialing is disabled until Phase 5 verification',
    });
  });

  router.post('/:id/transition', (req, res) => {
    const call = service.transition(String(req.params.id), req.body);
    res.json({ call });
  });

  return router;
}
