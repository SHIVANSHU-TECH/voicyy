import { getConfig } from './config/env.js';
import { createApp } from './app.js';
import { createLogger } from './lib/logger.js';
import { createQueueDriver } from './queue/index.js';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger(config);
  const queue = createQueueDriver(config, logger);

  await queue.start();

  const app = createApp({ config, logger, queue });
  const server = app.listen(config.API_PORT, config.API_HOST, () => {
    logger.info(
      {
        host: config.API_HOST,
        port: config.API_PORT,
        queueDriver: queue.name,
        liveCallingAllowed: config.liveCallingAllowed,
      },
      'Voice API listening',
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await queue.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
