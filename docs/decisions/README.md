# Decision records

Short notes on the choices that shape NeoBank: what we decided, what else we considered, and what it costs us. They record _why_ the code looks the way it does, so a later change can be made knowingly rather than by accident.

| #                                          | Decision                                                      | Status   |
| ------------------------------------------ | ------------------------------------------------------------- | -------- |
| [0001](0001-nx-monorepo-shared-schemas.md) | Nx monorepo with one set of Zod schemas for API and web       | Accepted |
| [0002](0002-money-as-integer-paise.md)     | Money as integer paise, with a double-entry ledger            | Accepted |
| [0003](0003-mongodb-transactions.md)       | Every money movement in one MongoDB transaction               | Accepted |
| [0004](0004-idempotency-keys.md)           | Idempotency keys, recorded in the same transaction            | Accepted |
| [0005](0005-tokens-memory-and-cookie.md)   | Access token in memory, rotating refresh token in a cookie    | Accepted |
| [0006](0006-totp-and-step-up.md)           | TOTP on Node `crypto`, and step-up through one interceptor    | Accepted |
| [0007](0007-signalstore-for-state.md)      | NgRx SignalStore and signals instead of classic NgRx Store    | Accepted |
| [0008](0008-bootstrap-ui-library.md)       | Bootstrap wrapped in our own UI library, themed with CSS vars | Accepted |
| [0009](0009-zod-mini.md)                   | `zod/mini` for the shared schemas                             | Accepted |
| [0010](0010-svg-chart.md)                  | A plain-SVG chart instead of a chart library                  | Accepted |
| [0011](0011-render-and-atlas.md)           | One Docker service on Render, with Atlas M0 in Singapore      | Accepted |

## Adding one

Copy the template below into `NNNN-short-title.md`, add a row above, and commit it with the change it explains. Don't edit an accepted decision to reverse it: write a new one that **supersedes** it and set the old one's status to `Superseded by NNNN`.

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context

What problem or force made a decision necessary?

## Decision

What we do, in one or two sentences, then the details that matter.

## Alternatives considered

- **Option:** why not.

## Consequences

What gets easier, what gets harder, and what we must remember.
```
