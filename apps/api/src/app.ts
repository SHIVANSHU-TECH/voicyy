import cors from 'cors';
import express from 'express';
import type { Application, Request } from 'express';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { Logger } from './lib/logger.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { QueueDriver } from './queue/index.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  queue: QueueDriver;
}

export function createApp(deps: AppDependencies): Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(
    cors({
      origin: deps.config.CORS_ORIGIN,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => (req as Request).requestId,
      customProps: (req) => ({ requestId: (req as Request).requestId }),
      autoLogging: deps.config.NODE_ENV !== 'test',
    }),
  );

  app.use(createHealthRouter(deps.config, deps.queue));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
