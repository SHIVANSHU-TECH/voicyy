import { Router } from 'express';
import type { DashboardService } from './dashboard.service.js';

export function createDashboardRouter(service: DashboardService): Router {
  const router = Router();

  router.get('/stats', (_req, res) => {
    res.json({ stats: service.stats() });
  });

  return router;
}
