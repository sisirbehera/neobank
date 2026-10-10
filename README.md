# NeoBank

A demo retail banking app built with the **MEAN** stack (MongoDB, Express, Angular, Node) in an **Nx monorepo**. It's a learning project: no real money moves.

**Live demo:** https://neobank-sisir.onrender.com (log in with the demo button on the login page; the first visit after a quiet spell takes up to a minute while the free server wakes up). **API docs:** [/api/docs](https://neobank-sisir.onrender.com/api/docs/).

## Stack

| Layer      | Tech                                                         |
| ---------- | ------------------------------------------------------------ |
| Monorepo   | Nx 23                                                        |
| Frontend   | Angular 22 (standalone, zoneless, signals), NgRx SignalStore |
| UI         | Bootstrap 5.3 + ng-bootstrap, wrapped in `@neobank/web/ui`   |
| Backend    | Node 24, Express 5, Mongoose 9                               |
| Validation | Zod 4 schemas shared by API and web                          |
| Tests      | Vitest, Supertest, Playwright                                |
| Hosting    | Render (Docker, free) + MongoDB Atlas M0 (free)              |

## Layout

```
apps/
  api/          Express API (also serves the built Angular app in production)
  web/          Angular SPA
  web-e2e/      Playwright tests
libs/
  shared/models @neobank/shared/models  Zod schemas + types (API and web)
  shared/utils  @neobank/shared/utils   INR / paise helpers
  web/ui        @neobank/web/ui         nb-* components, themes, ThemeService
```

Lint rules enforce the boundaries: `scope:web` and `scope:api` may only import their own scope and `scope:shared`.

## Getting started

```bash
npm install
npm start            # Angular on http://localhost:4200 + API on :3333
```

No database setup is needed. If `MONGODB_URI` is empty, the API starts an **in-memory MongoDB replica set**, and its data resets when the API restarts. For persistent local data, run `docker compose up -d` and set `MONGODB_URI` in `.env` (see `.env.example`).

In development the API seeds these logins on every start:

| Who                    | Email               | Password     |
| ---------------------- | ------------------- | ------------ |
| Demo customer (Priya)  | `demo@neobank.dev`  | `Demo@1234`  |
| Second customer (Ravi) | `ravi@neobank.dev`  | `Demo@1234`  |
| Admin                  | `admin@neobank.dev` | `Admin@1234` |

The admin must set up two-step verification on the first sign-in. Scan the QR code with any authenticator app.

Priya has 6 months of history (salary, rent share, bills, transfers with Ravi). In production, demo data is controlled by `SEED_DEMO_DATA`, and an admin exists **only** if you set `ADMIN_PASSWORD`.

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm start`     | Run web + API with live reload        |
| `npm test`      | Unit tests for every project          |
| `npm run lint`  | Lint every project                    |
| `npm run build` | Production build of API and web       |
| `npm run e2e`   | Playwright tests (starts the servers) |
| `npm run graph` | Interactive project dependency graph  |

## Conventions

- **Money is integer paise.** `₹1,050.00` is stored as `105000`. Display it with `<nb-amount>` or the `inr` pipe.
- **Validate at the edges with Zod.** The API uses `validateBody(Schema)`, and the web app parses responses with the same schema.
- **API errors** always have the shape `{ error: { code, message, fields? } }`.
- **Themes:** `ThemeService` sets `data-bs-theme` and `data-nb-theme` on `<html>`. To add a theme, edit `libs/web/ui/src/lib/styles/_themes.scss` and `THEMES` in `theme.service.ts`.
- **Forms:** use `<nb-form-field>` with `<input nbInput>` and `zodValidator(SharedSchema)`. Show API field errors with `applyServerErrors(form, error.fields)`.

## Features

- **Accounts:** savings and current accounts, simulated deposits and withdrawals, balances backed by an append-only double-entry ledger.
- **Transfers:** to your own accounts or saved beneficiaries, all-or-nothing in one MongoDB transaction, protected by idempotency keys and a ₹2,00,000 daily limit.
- **History and statements:** filters, search, IST dates, CSV export, and an accessible money in/out chart.
- **Security:** a short-lived access token in memory, a rotating refresh cookie, authenticator-app 2FA with backup codes (mandatory for admins), step-up codes for risky actions, password change and a devices list.
- **Admin:** stats, user search, freezing accounts with a required reason, and an audit log.
- **Quality:** about 230 unit tests and 10 browser tests, OpenAPI docs generated from the validation schemas, Lighthouse 100 for accessibility.

## Documentation

| Document                                     | Read it for                                                          |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md) | How the pieces fit, with diagrams of the money and sign-in flows     |
| [docs/features.md](docs/features.md)         | Every endpoint and the rules behind each feature                     |
| [docs/runbook.md](docs/runbook.md)           | Deploying to Render + Atlas, operating the live app, fixing problems |
| [docs/decisions/](docs/decisions/)           | Why things are built this way: one short note per big decision       |
| [docs/demo-script.md](docs/demo-script.md)   | A 5-minute click-through for showing the app                         |
| [docs/learning-log.md](docs/learning-log.md) | What each day taught, including the bugs we hit                      |

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Checks:** `npm audit --omit=dev --audit-level=high`, format, lint, typecheck (including test files), unit tests and build, for affected projects only.
2. **Browser tests:** the Playwright suite.
3. **Docker:** builds the production image, starts it next to a MongoDB replica set, and runs `tools/smoke.mjs` against it.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs. Angular, Nx and Vitest updates are grouped, because those packages must move together.

`.github/workflows/keep-alive.yml` runs the smoke test against the live app every Monday at 09:00 IST, and on demand from **Actions → Keep alive → Run workflow**. It catches a broken deployment (GitHub emails you when it fails), and the weekly database activity stops Atlas from pausing the free cluster. The URL comes from the repository variable `APP_URL`, defaulting to `https://neobank-sisir.onrender.com`.

## Roadmap

- [x] Day 1 – Monorepo, API skeleton, DB, themed UI kit, health check, CI, Docker
- [x] Day 2 – Authentication (JWT + refresh cookie)
- [x] Day 3 – Accounts + dashboard
- [x] Day 4 – Transfers, beneficiaries, idempotency
- [x] Day 5 – History, statements, chart, admin, demo data
- [x] Day 6 – Two-step verification, step-up for risky actions, password change, sessions
- [x] Day 7 – Performance, API docs, CI (Playwright + Docker smoke test), deployment setup

**Week 2 (planned):** polish and leftovers (404, toasts, idle logout, security activity) · notifications · scheduled transfers · fixed deposits · spending insights · observability and backups · PDF statements and PWA.
