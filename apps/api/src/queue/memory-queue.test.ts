import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { MemoryQueueDriver } from './memory-queue.js';

describe('MemoryQueueDriver', () => {
  it('deduplicates jobs by idempotency key', async () => {
    const driver = new MemoryQueueDriver(pino({ level: 'silent' }));
    await driver.start();

    const handler = vi.fn(async () => undefined);
    driver.registerHandler('calls', handler);

    const first = await driver.enqueue('calls', 'call:c1:ct1:a1', { n: 1 });
    const second = await driver.enqueue('calls', 'call:c1:ct1:a1', { n: 2 });

    expect(first.duplicated).toBe(false);
    expect(second.duplicated).toBe(true);
    expect(second.id).toBe(first.id);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await driver.stop();
  });
});
