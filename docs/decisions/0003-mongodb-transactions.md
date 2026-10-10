# 0003. Every money movement in one MongoDB transaction

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

A transfer touches several documents: two account balances, a daily-limit counter, a transaction, two ledger entries and an idempotency record. If the server crashes or a check fails halfway, the payer must not be debited without the payee being credited. Concurrent requests must also not overdraw an account through a "read balance, check, write" race.

## Decision

- Every money movement runs inside **one multi-document MongoDB transaction** (a Mongoose session). Any thrown error aborts all of it.
- Balance changes are **conditional atomic updates**, not read-modify-write: a debit is `$inc: { balance: -amount }` _where_ `balance >= amount`; a credit only matches an `ACTIVE` account. No match means "insufficient funds" or "recipient unavailable".
- MongoDB always runs as a **replica set**, because transactions require one: Atlas M0 is a 3-node set, and in development and tests `mongodb-memory-server` starts an in-memory replica set when `MONGODB_URI` is empty.

## Alternatives considered

- **PostgreSQL:** the classic choice for money, but the project is a MEAN learning stack.
- **No transactions, with compensating writes:** complex, and a crash between steps still leaves bad data.
- **Application-level locks:** don't survive a second server instance and add deadlock risks.

## Consequences

- Tests prove it: five concurrent ₹30 withdrawals from ₹100 give exactly three successes; a frozen recipient rolls back the payer's debit; total money across accounts is unchanged after concurrent transfers.
- Local development can't use a plain standalone `mongod`; `docker-compose.yml` starts a single-node replica set.
- Transactions can hit transient write conflicts under heavy contention. Mongoose's `connection.transaction()`, which the code uses, retries them through the driver's `withTransaction`.
