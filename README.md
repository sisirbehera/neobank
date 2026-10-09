# NeoBank

A demo retail banking app built with the **MEAN** stack (MongoDB, Express, Angular, Node) in an **Nx monorepo**. It's a learning project: no real money moves.

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

## Authentication

| Endpoint                  | Auth   | Purpose                                   |
| ------------------------- | ------ | ----------------------------------------- |
| `POST /api/auth/register` | –      | Create a customer, start a session (201)  |
| `POST /api/auth/login`    | –      | Start a session                           |
| `POST /api/auth/refresh`  | cookie | Swap the refresh cookie for a new session |
| `POST /api/auth/logout`   | cookie | Revoke the refresh token (204)            |
| `GET /api/auth/me`        | Bearer | Current user                              |

- **Access token:** a JWT (HS256) valid for 15 minutes. The browser keeps it **in memory only** and sends it as `Authorization: Bearer …`.
- **Refresh token:** a random opaque string in the `nb_rt` cookie (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` in production), valid for 7 days. Only its SHA-256 hash is stored in MongoDB.
- **Rotation and reuse detection:** every refresh revokes the old token and issues a new one. If a revoked token is used again, all of that user's sessions are revoked. The exception is a **30-second grace period** after a rotation, which covers lost responses such as a tab closed or reloaded mid-request, or two tabs refreshing at once.
- **Passwords** are hashed with Node's built-in `scrypt`. After 5 failed logins the account is locked for 15 minutes. Login and register are rate-limited per IP (`AUTH_RATE_LIMIT`). Refresh, which every page load calls, gets 10× that limit.
- **On page load**, Angular calls `/refresh` to restore the session. The interceptor refreshes and retries once on a `401`.
- **Protecting a route:** `router.get('/x', requireAuth(secret), requireRole('admin'), handler)`. On the web side, use `canActivate: [authGuard]`.

## Accounts and money movement

All endpoints need a Bearer token and only ever see the signed-in user's accounts. Another user's account returns `404`.

| Endpoint                          | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `GET /api/accounts`               | List my accounts                            |
| `POST /api/accounts`              | Open `SAVINGS` / `CURRENT` (max 5 per user) |
| `GET /api/accounts/:id`           | One account                                 |
| `POST /api/accounts/:id/deposit`  | Add money (demo, up to ₹1,00,000) ¹         |
| `POST /api/accounts/:id/withdraw` | Withdraw (`422 INSUFFICIENT_FUNDS`) ¹       |
| `GET /api/accounts/:id/activity`  | Latest ledger entries of one account        |
| `GET /api/accounts/activity`      | Latest entries across my accounts           |

- **Account numbers:** `NB` + 9 random digits + a Luhn check digit, so typos are caught on input (`isValidAccountNumber`).
- **Data model:** each money movement creates a **transaction** (the business event) and one **ledger entry** per affected account (`CREDIT`/`DEBIT`, `balanceAfter`). Ledger entries are append-only, so a balance always equals Σ credits − Σ debits.
- **Atomicity:** the balance `$inc`, the transaction and the ledger entry are written in one **MongoDB transaction**. A withdrawal only matches `balance >= amount`, so concurrent withdrawals can never overdraw. A test fires 5 at once to prove it.
- **Web:** `AccountsStore` uses `withEntities()` from NgRx. A deposit calls `setEntity(account)`, and the dashboard total and every card update. The store resets when a different user signs in.

¹ Requires an `Idempotency-Key` header (see below).

## Transfers and beneficiaries

| Endpoint                        | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `GET /api/beneficiaries`        | List my saved payees                                     |
| `POST /api/beneficiaries`       | Add one (the account must exist and not be mine; max 20) |
| `DELETE /api/beneficiaries/:id` | Remove one                                               |
| `POST /api/transfers`           | Transfer money ¹ (`201`)                                 |

- **Who can be paid:** your own accounts, or accounts saved as beneficiaries (`422 BENEFICIARY_REQUIRED` otherwise).
- **Atomic:** the debit, the credit, the daily-limit counter, the transaction, **both** ledger entries and the idempotency record are written in one MongoDB transaction. If the recipient account is frozen, the payer's debit is rolled back too.
- **Daily limit:** ₹2,00,000 per day (IST) to other people. It's enforced by a single conditional upsert on a per-user, per-day counter, so parallel transfers can't sneak past it. Transfers between your own accounts don't count.
- **Statements:** each ledger entry has a `counterparty`, e.g. "To Ravi · •••• 7897" or "From Asha Rao · •••• 1234".

### Idempotency

Every money-moving request carries an `Idempotency-Key` header, a random value such as `crypto.randomUUID()` generated once per user action.

- **Same key, same request:** the API returns the original response with `Idempotent-Replayed: true`. No money moves twice, even when identical requests arrive at the same moment. A test sends 5 at once.
- **Same key, different request:** `422 IDEMPOTENCY_KEY_REUSED`.
- **Failed requests save nothing**, so retrying with corrected input is fine.
- **The record is written in the same transaction as the money movement**, so they always commit together. Records expire after 24 hours.
- **On the web side**, the transfer page creates a key when you reach **Review** and reuses it if **Confirm** is retried. The Add money / Withdraw dialog uses one key per dialog.

## Deploying (Render + Atlas)

1. **Atlas:** create an M0 cluster (Mumbai or Singapore), a database user, and allow network access from `0.0.0.0/0`. Copy the `mongodb+srv://…/neobank` connection string.
2. **Render:** push this repo to GitHub, then choose **New → Blueprint** and pick the repo. `render.yaml` creates a free Docker web service. Paste the Atlas string as `MONGODB_URI`.
3. Open `https://<service>.onrender.com/api/health`. It should report `"db": "up"`.

On the free tier the service sleeps after 15 minutes idle, so the first request after that takes about 30–60 seconds.

## Roadmap

- [x] Day 1 – Monorepo, API skeleton, DB, themed UI kit, health check, CI, Docker
- [x] Day 2 – Authentication (JWT + refresh cookie)
- [x] Day 3 – Accounts + dashboard
- [x] Day 4 – Transfers, beneficiaries, idempotency
- [ ] Day 5 – History, statements, admin
- [ ] Day 6 – Tests, security hardening
- [ ] Day 7 – Deploy
