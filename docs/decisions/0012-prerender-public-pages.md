# 0012. Pre-render the public pages; render signed-in pages in the browser

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Until now every page was an empty `index.html` that Angular filled in after downloading about 140 KB of JavaScript. On a slow phone the visitor sees nothing until then. Angular can render pages to HTML ahead of time ("server-side rendering"), either on every request or once at build time, and then hydrate them: reuse that HTML instead of drawing the page again.

Two facts limit what can be rendered ahead of time:

- **The server doesn't know who is asking.** The access token lives in browser memory, and the refresh cookie is sent only to `/api/auth` ([0005](0005-tokens-memory-and-cookie.md)). A page request carries no identity.
- **Personal banking data must not be baked into HTML** that a browser or proxy might cache.

## Decision

Choose per route (`apps/web/src/app/app.routes.server.ts`):

- **Prerender** (built once, at build time): home, log in, register. They are the same for every visitor and are what a new visitor sees first.
- **Client** (rendered in the browser): everything else, including every signed-in page and the 404 page. The build writes an empty shell, `index.csr.html`, for them.

The build uses `outputMode: "static"`, so the output is plain files. The API serves them (`apps/api/src/lib/web-app.ts`): the pre-built page for its address, otherwise the shell. No Node rendering server runs.

What hydration needed around it:

- **CSP:** hydration's event replay adds inline scripts, and so does our theme script. The API reads the built pages at startup and allows exactly those scripts by their SHA-256 hash. Any other inline script is still blocked; there is no `'unsafe-inline'`.
- **Browser-only work is skipped while pre-rendering:** restoring the session, the health check, timers.
- **A script in `index.html`** runs before the first paint. It applies the saved theme (no flash of the light theme). It hides the "Log in" buttons while the `nb_session` hint cookie says a session probably exists (no flash of signed-out content). And it stops the browser submitting forms itself before Angular has loaded.
- **Text typed before Angular loads is kept.** The shared `nbInput` directive reads it before the form overwrites it with its starting value.

## Alternatives considered

- **Render on every request (`RenderMode.Server`):** a Node rendering server on the free 512 MB instance, for pages that are the same for everyone anyway. It would only pay off for personalised pages, which we can't render (no identity) and shouldn't (caching).
- **Pre-render signed-in pages with placeholders:** the visitor would see an empty skeleton, then the real page: two layouts for little gain.
- **Allow `'unsafe-inline'` scripts:** simplest, but it removes most of what the CSP protects against.
- **A per-request CSP nonce:** needs the HTML rewritten on every request. Hashes work with static files.
- **Keep the single-page app as it was:** the first screen waits for all the JavaScript.

## Consequences

- Public pages show their content before any JavaScript runs, even with JavaScript off. Signed-in pages are unchanged.
- The startup download grew from 139 KB to 149 KB gzipped: hydration and the event-replay runtime. Lighthouse before and after is planned for Day 12.
- **The inline scripts' hashes are computed when the API starts.** A deploy restarts it, so they always match. A smoke test checks that every inline script on the live home page is allowed.
- **Code that runs while a component is created must work in Node:** no `window`, `document` or `localStorage` outside `isPlatformBrowser`, `afterNextRender` or event handlers.
- **Hydration only works on the HTML Angular rendered.** Code that changes the DOM directly, or HTML that differs between build and browser, breaks it. Angular reports such mismatches in the console in development.
- The dev server (`nx serve web`) renders these pages too. A dev server started before the SSR configuration existed keeps serving the old setup until it is restarted.
