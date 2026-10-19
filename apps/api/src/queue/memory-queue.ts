import { ConflictError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { EnqueueResult, JobHandler, QueueDriver } from './types.js';

interface StoredJob {
  id: string;
  idempotencyKey: string;
  payload: unknown;
}

/**
 * Development / fallback queue. Processes jobs asynchronously in-process.
 * Redis/BullMQ will replace this when REDIS_URL is configured (Phase 3+).
 */
export class MemoryQueueDriver implements QueueDriver {
  readonly name = 'memory' as const;
  private readonly seenKeys = new Map<string, string>();
  private readonly handlers = new Map<string, JobHandler>();
  private readonly pending = new Map<string, StoredJob[]>();
  private started = false;

  constructor(private readonly logger: Logger) {}

  async start(): Promise<void> {
    this.started = true;
    this.logger.info({ driver: this.name }, 'Queue driver started');
  }

  async stop(): Promise<void> {
    this.started = false;
    this.pending.clear();
    this.logger.info({ driver: this.name }, 'Queue driver stopped');
  }

  registerHandler<T>(queueName: string, handler: JobHandler<T>): void {
    this.handlers.set(queueName, handler as JobHandler);
  }

  size(queueName: string): number {
    return this.pending.get(queueName)?.length ?? 0;
  }

  async enqueue<T>(queueName: string, idempotencyKey: string, payload: T): Promise<EnqueueResult> {
    if (!this.started) {
      throw new ConflictError('Queue is not started');
    }

    const existing = this.seenKeys.get(idempotencyKey);
    if (existing) {
      return { id: existing, idempotencyKey, duplicated: true };
    }

    const id = `${queueName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.seenKeys.set(idempotencyKey, id);

    const job: StoredJob = { id, idempotencyKey, payload };
    const list = this.pending.get(queueName) ?? [];
    list.push(job);
    this.pending.set(queueName, list);

    queueMicrotask(() => {
      void this.processNext(queueName);
    });

    return { id, idempotencyKey, duplicated: false };
  }

  private async processNext(queueName: string): Promise<void> {
    const list = this.pending.get(queueName);
    if (!list || list.length === 0) return;

    const job = list.shift();
    if (!job) return;

    const handler = this.handlers.get(queueName);
    if (!handler) {
      this.logger.warn({ queueName, jobId: job.id }, 'No handler registered for queue');
      return;
    }

    try {
      await handler(job.payload);
    } catch (err) {
      this.logger.error({ err, queueName, jobId: job.id }, 'Memory queue job failed');
    } finally {
      if ((this.pending.get(queueName)?.length ?? 0) > 0) {
        queueMicrotask(() => {
          void this.processNext(queueName);
        });
      }
    }
  }

  /** Test helper — drain pending jobs (bounded). */
  async flush(maxTicks = 50): Promise<void> {
    for (let i = 0; i < maxTicks; i += 1) {
      const pending = [...this.pending.values()].reduce((n, list) => n + list.length, 0);
      if (pending === 0) {
        await new Promise((r) => setTimeout(r, 0));
        const still = [...this.pending.values()].reduce((n, list) => n + list.length, 0);
        if (still === 0) return;
      }
      await new Promise((r) => setTimeout(r, 5));
    }
  }
}
