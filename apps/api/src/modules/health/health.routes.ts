import { Router } from 'express';
import type { AppConfig } from '../../config/env.js';
import { publicConfigView } from '../../config/env.js';
import type { QueueDriver } from '../../queue/index.js';

export function createHealthRouter(config: AppConfig, queue: QueueDriver): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'voice-api',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', (_req, res) => {
    const ready = Boolean(queue);
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      queueDriver: queue.name,
      liveCallingAllowed: config.liveCallingAllowed,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/api/v1/meta', (_req, res) => {
    res.status(200).json({
      name: 'ai-voice-calling-agent',
      version: '0.1.0',
      phase: 2,
      config: publicConfigView(config),
    });
  });

  return router;
}
