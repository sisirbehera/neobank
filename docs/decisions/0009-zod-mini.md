# 0009. `zod/mini` for the shared schemas

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

[0001](0001-nx-monorepo-shared-schemas.md) puts the Zod schemas in the browser bundle. On Day 7, measuring the production build showed classic Zod was nearly half of the JavaScript needed to show the first page: its method-chaining API (`z.string().trim().min(1)`) keeps every method attached to every schema, so bundlers can't drop the unused ones.

## Decision

Write `libs/shared/models` with **`zod/mini`**, Zod's functional API (`z.string().check(z.trim(), z.minLength(1))`, `z.optional(...)`, `z.pipe(...)`). The rules are identical, and bundlers keep only the functions used. The API's own schemas (environment, internal) keep classic `zod`. Both build on Zod's shared core, so the API's `validateBody` and `parseQuery` accept either kind through the core `$ZodType`.

## Alternatives considered

- **Keep classic Zod and accept the size.**
- **Validate only on the server:** loses instant form feedback and response parsing in the browser.
- **Valibot:** similarly small, but a rewrite onto a different library, and the API would then use two validation libraries.

## Consequences

- Zod in the browser went from about 450 KB to about 25 KB raw. The startup download fell from 222 KB to 136 KB gzipped, together with the other Day 7 changes.
- All 231 tests passed unchanged after the rewrite, which confirmed the behaviour was the same.
- The functional style is less familiar and a little more verbose; most Zod examples online use the classic style.
