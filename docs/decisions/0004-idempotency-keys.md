# 0004. Idempotency keys, recorded in the same transaction

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Networks lose responses. A user double-clicks "Confirm", a mobile connection drops after the server committed, or the step-up dialog retries a request. Without protection, each retry moves the money again.

## Decision

Every money-moving request carries an **`Idempotency-Key`** header: a random UUID created once per user action (the transfer page creates it at **Review** and reuses it on every retry of **Confirm**).

- The API stores an idempotency record (user, key, scope, a hash of the request, the response) **inside the same MongoDB transaction** as the money movement. They commit together or not at all.
- **Same key, same request:** the stored response is returned with `Idempotent-Replayed: true`, and no money moves.
- **Same key, different request:** `422 IDEMPOTENCY_KEY_REUSED`.
- **Failed requests store nothing**, so the user can correct the input and retry with the same key.
- A unique index on (user, key) makes two identical requests arriving at the same moment safe: one commits, the other replays. Records expire after 24 hours (TTL index).

## Alternatives considered

- **Disable the button while sending:** helps with double clicks, but not with lost responses or retries after a reload.
- **Detect duplicates by amount and payee within a time window:** blocks legitimate repeated payments and misses retries outside the window.
- **Store the record after the transaction commits:** a crash between the two leaves money moved with no record, so the retry pays again.

## Consequences

- Clients must generate and keep a key per action. The web app does; API users must too (the OpenAPI docs say so).
- A test sends five identical transfers at once and gets exactly one transfer.
- The step-up retry (see [0006](0006-totp-and-step-up.md)) reuses the original key, so asking for a code can never cause a double payment.
