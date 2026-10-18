import { Router } from 'express';
import type { SettingsService } from './settings.service.js';

export function createSettingsRouter(service: SettingsService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ settings: service.get() });
  });

  router.patch('/', (req, res) => {
    res.json({ settings: service.patch(req.body) });
  });

  return router;
}
