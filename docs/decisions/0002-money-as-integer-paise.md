# 0002. Money as integer paise, with a double-entry ledger

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Floating-point numbers can't represent most decimal fractions exactly: in JavaScript `0.1 + 0.2` is `0.30000000000000004`. Repeated over thousands of transactions, those errors become missing or invented paise. A bank also has to explain every balance: "why is it ₹4,210.50?" needs an answer.

## Decision

1. **Every amount is an integer number of paise**: in MongoDB, in the API, in the shared schemas and in Angular state. `₹1,050.00` is `105000`. Only the display layer (`<nb-amount>`, the `inr` pipe, the CSV export) formats it, and user input is parsed digit by digit (`RupeeInputSchema`), never through `parseFloat`.
2. **Every movement writes a transaction and ledger entries.** A transaction is the business event; each ledger entry is its effect on one account (`CREDIT` or `DEBIT`) with `balanceAfter`. Ledger entries are append-only. A transfer writes two entries, a deposit or withdrawal one.

The account's `balance` field is kept for fast reads, but it must always equal the sum of its ledger entries, and tests check that after mixed concurrent activity.

## Alternatives considered

- **Floats in rupees:** rounding errors, as above.
- **`Decimal128` in MongoDB:** exact, but awkward in JavaScript (no native decimal type) and in JSON.
- **Balance only, no ledger:** simpler, but there's no history to audit or rebuild a balance from.

## Consequences

- Integer maths in JavaScript is exact up to `Number.MAX_SAFE_INTEGER` paise (about ₹90 trillion), which is far beyond any demo limit.
- Every new money feature (fixed-deposit interest, fees) must decide its rounding rule explicitly and write ledger entries.
- Statements and the monthly chart come straight from the ledger, with no reconstruction.
