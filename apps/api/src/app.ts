import express, { Router } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AppConfig } from './config/app-config';
import { apiNotFound, errorHandler } from './middleware/error-handler';
import { adminRoutes } from './modules/admin/admin.routes';
import { accountsRoutes } from './modules/accounts/accounts.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { beneficiariesRoutes } from './modules/beneficiaries/beneficiaries.routes';
import { docsRoutes } from './modules/docs/docs.routes';
import { healthRoutes } from './modules/health/health.routes';
import { historyRoutes } from './modules/history/history.routes';
import { securityRoutes } from './modules/security/security.routes';
import { transfersRoutes } from './modules/transfers/transfers.routes';

/** Angular adds an 8-character content hash to built files: main-4G73D47B.js, chunk-D-aySZ6s.js. */
const HASHED_FILE = /-[A-Za-z0-9_-]{8}\.(js|css)$/;

export function createApp(config: AppConfig) {
  const app = express();

  app.disable('x-powered-by');
  // Render (like most PaaS) sits behind one proxy; needed for real client IPs.
  app.set('trust proxy', 1);

  app.use(helmet());
  // gzip/brotli: JSON and the Angular bundle shrink to ~25% on the wire.
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  // Account data must never sit in a browser or proxy cache.
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use('/health', healthRoutes(config.version, config.demoDataEnabled));
  api.use('/docs', docsRoutes(config.version));
  api.use('/auth', authRoutes(config.auth));
  api.use('/security', securityRoutes(config.auth));
  api.use('/accounts', accountsRoutes(config.auth.accessTokenSecret));
  api.use('/beneficiaries', beneficiariesRoutes(config.auth));
  api.use('/transfers', transfersRoutes(config.auth));
  api.use('/transactions', historyRoutes(config.auth.accessTokenSecret));
  api.use(
    '/admin',
    adminRoutes({
      accessTokenSecret: config.auth.accessTokenSecret,
      demoDataEnabled: config.demoDataEnabled,
    }),
  );
  api.use(apiNotFound);
  app.use('/api', api);

  // In production Express also serves the Angular app: one service, one URL.
  const webRoot = config.staticDir ? resolve(config.staticDir) : undefined;
  if (webRoot && existsSync(join(webRoot, 'index.html'))) {
    app.use(
      express.static(webRoot, {
        index: false,
        setHeaders: (res, filePath) => {
          // Hashed files never change: cache for a year. Everything else
          // (favicon, …) is revalidated so a deploy is picked up at once.
          res.set(
            'Cache-Control',
            HASHED_FILE.test(filePath)
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
          );
        },
      }),
    );
    // SPA fallback: every other GET is handled by Angular's router.
    // index.html is never cached, so users always get the newest bundle names.
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(webRoot, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
