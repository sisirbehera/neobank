import express, { Router } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import type { AppConfig } from './config/app-config';
import { LANGUAGE_COOKIE } from '@neobank/shared/models';
import { loadWebApp, preferredLanguage, resolvePage } from './lib/web-app';
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
  // In production Express also serves the Angular app: one service, one URL.
  const webRoot = config.staticDir ? resolve(config.staticDir) : undefined;
  const web = webRoot ? loadWebApp(webRoot) : undefined;

  app.disable('x-powered-by');
  // Render (like most PaaS) sits behind one proxy; needed for real client IPs.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Scripts from our own origin, plus the app's known inline scripts
          // by hash. Any other inline script (e.g. injected) is still blocked.
          scriptSrc: ["'self'", ...(web?.scriptHashes ?? [])],
        },
      },
    }),
  );
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

  if (webRoot && web) {
    app.use(
      express.static(webRoot, {
        index: false,
        // /login is a page, not a folder: no redirect to /login/.
        redirect: false,
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
    // Pages: the one built ahead of time for this address, or the shell that
    // Angular's router fills in. An address without a language goes to the
    // visitor's language. HTML is never cached, so users always get the
    // newest bundle names.
    app.get('/{*path}', (req, res) => {
      const result = resolvePage(web, req.path, () =>
        preferredLanguage(
          web,
          req.cookies[LANGUAGE_COOKIE],
          req.get('accept-language'),
        ),
      );
      if ('redirectTo' in result) {
        const query = req.originalUrl.slice(req.path.length);
        // The answer depends on the cookie and the browser's languages.
        res.set({
          'Cache-Control': 'no-store',
          Vary: 'Cookie, Accept-Language',
        });
        res.redirect(302, result.redirectTo + query);
        return;
      }
      res.set('Cache-Control', 'no-cache');
      res.sendFile(result.file);
    });
  }

  app.use(errorHandler);
  return app;
}
