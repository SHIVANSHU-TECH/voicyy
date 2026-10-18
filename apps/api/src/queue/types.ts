export type JobHandler<T = unknown> = (payload: T) => Promise<void> | void;

export interface EnqueueResult {
  id: string;
  idempotencyKey: string;
  duplicated: boolean;
}

export interface QueueDriver {
  readonly name: 'memory' | 'redis';
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueue<T>(queueName: string, idempotencyKey: string, payload: T): Promise<EnqueueResult>;
  registerHandler<T>(queueName: string, handler: JobHandler<T>): void;
  size(queueName: string): number;
}
