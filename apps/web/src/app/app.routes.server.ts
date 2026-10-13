import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * How each page reaches the browser (decision record 0012):
 *  - Prerender: built to HTML once, at build time. Public pages that are the
 *    same for every visitor, so the first screen appears before any
 *    JavaScript has run.
 *  - Client: an empty shell that Angular fills in the browser. Everything
 *    behind a login: the server never knows who is asking (the session lives
 *    in browser memory and a cookie scoped to /api/auth), and personal
 *    banking data must not be baked into cacheable HTML anyway.
 * The API serves these files as they are, so no Node rendering server runs.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
