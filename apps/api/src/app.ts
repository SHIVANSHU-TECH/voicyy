import cors from 'cors';
import express from 'express';
import type { Application, Request } from 'express';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { Logger } from './lib/logger.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { createCallsRouter } from './modules/calls/calls.routes.js';
import { CallsService } from './modules/calls/calls.service.js';
import { CampaignEngine } from './modules/campaigns/campaign-engine.js';
import { createCampaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { CampaignsService } from './modules/campaigns/campaigns.service.js';
import { registerSimulatedCallWorker } from './modules/campaigns/simulated-worker.js';
import { createContactsRouter } from './modules/contacts/contacts.routes.js';
import { ContactsService } from './modules/contacts/contacts.service.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { DashboardService } from './modules/dashboard/dashboard.service.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { SettingsService, settingsFromConfig } from './modules/settings/settings.service.js';
import type { QueueDriver } from './queue/index.js';
import { createStore, type MemoryStore } from './store/memory-store.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  queue: QueueDriver;
  store?: MemoryStore;
}

export function createApp(deps: AppDependencies): Application {
  const app = express();
  const store = deps.store ?? createStore(settingsFromConfig(deps.config));

  const engine = new CampaignEngine(
    store,
    deps.queue,
    deps.logger,
    deps.config.liveCallingAllowed,
  );
  registerSimulatedCallWorker({
    queue: deps.queue,
    store,
    engine,
    logger: deps.logger,
  });

  const contacts = new ContactsService(store);
  const campaigns = new CampaignsService(store);
  const calls = new CallsService(store, engine);
  const settings = new SettingsService(store, deps.config);
  const dashboard = new DashboardService(store, deps.config);

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(
    cors({
      origin: deps.config.CORS_ORIGIN,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => (req as Request).requestId,
      customProps: (req) => ({ requestId: (req as Request).requestId }),
      autoLogging: deps.config.NODE_ENV !== 'test',
    }),
  );

  app.use(createHealthRouter(deps.config, deps.queue));
  app.use('/api/v1/dashboard', createDashboardRouter(dashboard));
  app.use('/api/v1/contacts', createContactsRouter(contacts));
  app.use('/api/v1/campaigns', createCampaignsRouter(campaigns, engine));
  app.use('/api/v1/calls', createCallsRouter(calls));
  app.use('/api/v1/settings', createSettingsRouter(settings));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
