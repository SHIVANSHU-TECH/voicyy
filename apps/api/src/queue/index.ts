import type { AppConfig } from '../config/env.js';
import type { Logger } from '../lib/logger.js';
import { MemoryQueueDriver } from './memory-queue.js';
import type { QueueDriver } from './types.js';

export type { EnqueueResult, JobHandler, QueueDriver } from './types.js';

/**
 * Resolves the queue implementation.
 * Redis/BullMQ is intentionally not wired yet — when QUEUE_MODE/auto selects redis
 * without an implementation, we fall back to memory and log clearly (Phase 1).
 */
export function createQueueDriver(config: AppConfig, logger: Logger): QueueDriver {
  if (config.queueDriver === 'redis') {
    logger.warn(
      {
        redisConfigured: Boolean(config.REDIS_URL),
      },
      'Redis queue selected but BullMQ adapter is not implemented yet; using in-memory queue for Phase 1',
    );
  }

  return new MemoryQueueDriver(logger);
}
