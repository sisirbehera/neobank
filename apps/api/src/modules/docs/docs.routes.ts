import express, { Router } from 'express';
import { getAbsoluteFSPath } from 'swagger-ui-dist';
import { buildOpenApi } from './openapi';

/** Points Swagger UI at our OpenAPI document (replaces its demo initializer). */
const INITIALIZER = `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: '/api/docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
  });
};
`;

/**
 * /api/docs: Swagger UI (served from node_modules, no CDN, so it works under
 * the strict Content-Security-Policy) and /api/docs/openapi.json.
 */
export function docsRoutes(version = '0.0.0'): Router {
  const router = Router();
  const document = buildOpenApi(version); // built once at startup

  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });

  router.get('/swagger-initializer.js', (_req, res) => {
    res.type('application/javascript').send(INITIALIZER);
  });

  // Relative asset links need a trailing slash: /api/docs → /api/docs/
  router.get('/', (req, res, next) => {
    if (req.originalUrl.endsWith('/')) return next();
    res.redirect(301, `${req.originalUrl}/`);
  });

  router.use(express.static(getAbsoluteFSPath()));
  return router;
}
