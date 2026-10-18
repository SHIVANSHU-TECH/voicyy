import { Router } from 'express';
import type { CampaignsService } from './campaigns.service.js';

export function createCampaignsRouter(service: CampaignsService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ campaigns: service.list() });
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

  return router;
}
