# 0007. NgRx SignalStore and signals instead of classic NgRx Store

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Several pages share state: a deposit on the account page must update the dashboard total, the navbar must know who is signed in, and signing in as a different user must clear the previous user's data. Angular now runs on signals (and NeoBank is zoneless), so state should be signals too.

## Decision

- **Parent ↔ child:** signal `input()`, `output()` and `model()`. Presentational components (the UI library and small feature pieces) know nothing about stores.
- **Shared feature state:** an **NgRx SignalStore** for each piece of state that several pages share (`AuthStore`, `AccountsStore`, `BeneficiariesStore`, `SystemStatusStore`), provided in root. State used by a single page stays in that page (the history filters, for example, live in the URL). Lists use `withEntities()`, so a deposit calls `setEntity(account)` and every view of that account updates.
- **Pages** inject stores and call their methods; stores call the `*.api.ts` services; RxJS stays where it fits best (HTTP, debounced search, `rxMethod`).
- Stores reset when a different user signs in.

## Alternatives considered

- **Classic NgRx Store** (actions, reducers, effects, selectors): powerful and great with DevTools, but a lot of code for an app this size.
- **Plain services with `signal()`:** fine for one or two pieces of state, but each service reinvents loading/error handling and entity updates.
- **RxJS `BehaviorSubject` services:** the pre-signals pattern; more subscriptions to manage.

## Consequences

- Little boilerplate, and components need no `subscribe` or `async` pipe.
- Less time-travel tooling than classic NgRx.
- A new feature follows the same recipe: `feature.api.ts` + `feature.store.ts` in `core/`, pages in `features/`.
