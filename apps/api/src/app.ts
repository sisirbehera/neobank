import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { apiNotFound, errorHandler } from './middleware/error-handler';
import { healthRoutes } from './modules/health/health.routes';

export interface AppOptions {
  version: string;
  /** Folder with the built Angular app; skipped if it doesn't exist. */
  staticDir?: string;
}

export function createApp({ version, staticDir }: AppOptions) {
  const app = express();

  app.disable('x-powered-by');
  // Render (like most PaaS) sits behind one proxy; needed for real client IPs.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  api.use('/health', healthRoutes(version));
  api.use(apiNotFound);
  app.use('/api', api);

  // In production Express also serves the Angular app: one service, one URL.
  const webRoot = staticDir ? resolve(staticDir) : undefined;
  if (webRoot && existsSync(join(webRoot, 'index.html'))) {
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }));
    // SPA fallback: every other GET is handled by Angular's router.
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(webRoot, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
