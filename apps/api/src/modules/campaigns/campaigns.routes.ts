import { Router } from 'express';
import type { CampaignEngine } from './campaign-engine.js';
import type { CampaignsService } from './campaigns.service.js';

export function createCampaignsRouter(
  service: CampaignsService,
  engine: CampaignEngine,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ campaigns: service.list() });
  });

  router.post('/retries/process', async (_req, res) => {
    const created = await engine.processRetries();
    res.json({ created });
  });

  router.get('/:id', (req, res) => {
    res.json({ campaign: service.get(String(req.params.id)) });
  });

  router.post('/', (req, res) => {
    const campaign = service.create(req.body);
    res.status(201).json({ campaign });
  });

  router.patch('/:id', (req, res) => {
    const campaign = service.update(String(req.params.id), req.body);
    res.json({ campaign });
  });

  router.post('/:id/submit-approval', (req, res) => {
    const campaign = service.submitForApproval(String(req.params.id));
    res.json({ campaign });
  });

  router.post('/:id/approve-script', (req, res) => {
    const campaign = service.approveScript(String(req.params.id));
    res.json({ campaign });
  });

  router.post('/:id/pause', (req, res) => {
    const campaign = service.pause(String(req.params.id));
    res.json({ campaign });
  });

  router.post('/:id/resume', async (req, res) => {
    const campaign = service.resume(String(req.params.id));
    const dispatched = await engine.dispatchAvailable(campaign.id);
    res.json({ campaign, dispatched });
  });

  router.post('/:id/launch', async (req, res) => {
    const contactIds = Array.isArray(req.body?.contactIds) ? req.body.contactIds : undefined;
    const result = await engine.launch(String(req.params.id), { contactIds });
    res.status(201).json({
      ...result,
      warning:
        result.mode === 'simulated'
          ? 'NOT_A_REAL_CALL — Phase 3 engine uses simulated dial worker only'
          : undefined,
    });
  });

  router.post('/:id/dispatch', async (req, res) => {
    const dispatched = await engine.dispatchAvailable(String(req.params.id));
    res.json({ dispatched });
  });

  return router;
}
