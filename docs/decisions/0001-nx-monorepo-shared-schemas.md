# 0001. Nx monorepo with one set of Zod schemas for API and web

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

The Angular app and the Express API both need to know what a valid transfer, login or account looks like. Written twice, the rules drift: the form accepts something the API rejects, or worse, the API accepts something the form never allowed. TypeScript types alone don't help at runtime, because they disappear when the code is compiled.

## Decision

Keep both apps in one **Nx** workspace, with a `libs/shared/models` library of **Zod** schemas. Each schema is the single source of truth for one shape:

- the API validates request bodies and query strings with it (`validateBody`, `parseQuery`);
- Angular forms validate input with it (`zodValidator`) and parse API responses with it;
- the OpenAPI document at `/api/docs` is generated from it (`z.toJSONSchema`);
- the TypeScript types are inferred from it, so there are no hand-written interfaces.

Nx tags (`scope:web`, `scope:api`, `scope:shared`) plus an ESLint rule stop the apps from importing each other's code.

## Alternatives considered

- **Two repositories with a published package:** every schema change needs a version bump and two pull requests.
- **Plain npm workspaces:** works, but without Nx's project graph, `affected` builds in CI and boundary rules.
- **class-validator / Joi:** decorators or runtime-only checks; no inferred types, and harder to run in the browser.
- **OpenAPI first, generating code from YAML:** the spec becomes the source of truth, but it's a second language to maintain and the generated validation is weaker.

## Consequences

- A rule change is one edit, and both sides and the docs follow. A test fails if a documented route doesn't exist.
- Nx adds its own concepts (targets, executors, tags) and upgrades must move all `@nx/*` packages together (Dependabot groups them).
- The shared library ships to the browser, so its size matters. See [0009](0009-zod-mini.md).
