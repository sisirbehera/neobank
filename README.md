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
- **Rotation and reuse detection:** every refresh revokes the old token and issues a new one in the same **session** (one sign-in on one device). If a token that was already _rotated_ is used again, all of that user's sessions are revoked. The exception is a **30-second grace period** after a rotation, which covers lost responses such as a tab closed or reloaded mid-request, or two tabs refreshing at once. Tokens ended by logging out or "sign out this device" just stop working, without logging out everywhere.
- **Passwords** are hashed with Node's built-in `scrypt`. After 5 failed logins the account is locked for 15 minutes. Login and register are rate-limited per IP (`AUTH_RATE_LIMIT`). Refresh, which every page load calls, gets 10× that limit.
- **On page load**, Angular calls `/refresh` to restore the session. The interceptor refreshes and retries once on a `401`.
- **Protecting a route:** `router.get('/x', requireAuth(secret), requireRole('admin'), handler)`. On the web side, use `canActivate: [authGuard]`.

## Two-step verification and security

Codes come from any authenticator app (TOTP, RFC 6238, implemented with Node's `crypto` in [`lib/totp.ts`](apps/api/src/lib/totp.ts)). 2FA is **optional for customers** and **mandatory for admins**.

| Endpoint                                    | Purpose                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| `POST /api/auth/login`                      | A session, **or** `{ mfaRequired, mfaToken, method }`          |
| `POST /api/auth/mfa/verify`                 | `mfaToken` + 6-digit or backup code → session                  |
| `POST /api/auth/mfa/enroll/start\|confirm`  | Admin's first sign-in: QR code → code → session + backup codes |
| `POST /api/security/mfa/setup\|enable`      | Turn 2FA on (Security page)                                    |
| `POST /api/security/mfa/disable`            | Password + code (not allowed for admins)                       |
| `POST /api/security/mfa/backup-codes`       | New set of 10 backup codes                                     |
| `POST /api/security/step-up`                | Fresh code → 5-minute token for one risky action               |
| `POST /api/security/password`               | Change password, signs out other devices                       |
| `GET /api/security/sessions`                | Signed-in devices (one row per session)                        |
| `DELETE /api/security/sessions/:id`         | Sign out one device                                            |
| `POST /api/security/sessions/revoke-others` | Sign out all other devices                                     |

- **Two steps:** with 2FA on, the password alone only earns a 5-minute challenge token (a JWT with its own audience, so it can't be used as an access token). The session starts after a correct code.
- **Admins:** an admin without 2FA gets `method: "ENROLL"` and must set it up before getting in. `/api/admin/*` also checks the access token's `mfa` claim.
- **Step-up for risky actions:** adding a beneficiary, and transfers to other people above ₹10,000, answer `403 STEP_UP_REQUIRED` (`meta.action`). The web app's `stepUpInterceptor` asks for a code, gets a step-up token and retries the same request with `X-Step-Up-Token`. Retries keep their Idempotency-Key. Transfers between your own accounts never need a code.
- **Storage:**
  - the TOTP secret is AES-256-GCM encrypted (`MFA_ENCRYPTION_KEY`);
  - backup codes are SHA-256 hashed and single-use;
  - `lastUsedStep` stops a code from being used twice.
- **Lockout:** wrong passwords, codes and step-up codes share one counter (5 tries → locked for 15 minutes).
- **Sessions:** the access token carries the session id (`sid`), so the API knows which device is "this device". Signing a device out stops its refresh. Its current access token expires within 15 minutes.

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

## History, statements and chart

| Endpoint                           | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/transactions`            | My ledger entries: `accountId, type, direction, from, to, q, page, pageSize` |
| `GET /api/transactions/export.csv` | Same filters as a CSV statement (max 5,000 rows)                             |
| `GET /api/transactions/summary`    | Money in/out per month, last 6 months                                        |

- **Dates are Indian Standard Time.** `from`/`to` are inclusive IST calendar days, and months are grouped in IST (`$dateToString` with `timezone: 'Asia/Kolkata'`).
- **The chart excludes own-account transfers.** They're flagged `internal` on the ledger entry, because moving money between your own accounts isn't income or spending.
- **CSV safety:** amounts come from integer maths. Text cells that start with `= + - @` are prefixed with `'`, so spreadsheets don't run them as formulas (CSV injection).
- **Search is literal:** the user's text is regex-escaped before querying.
- **Web:** the filters live in the URL, so a filtered view can be bookmarked and Back works. While new results load, the previous ones stay on screen, dimmed. `<nb-column-chart>` (UI library) is a plain-SVG chart: validated colour-blind-safe colours with separate light and dark steps, a legend, a hover or keyboard tooltip, and a **Show table** view.

## Admin

Every `/api/admin/*` route requires `requireAuth` + `requireRole('admin')`. In the app, the **Admin** link and the `/admin` pages appear only for admins (`adminGuard`).

| Endpoint                                | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `GET /api/admin/stats`                  | Users, accounts, frozen, deposits held, today's volume |
| `GET /api/admin/users?q&page`           | Search users, with account count and total balance     |
| `GET /api/admin/users/:id`              | One user and all their accounts                        |
| `PATCH /api/admin/accounts/:id/status`  | `{ status: ACTIVE \| FROZEN, reason }`                 |
| `GET /api/admin/transactions?type&page` | Every transaction, newest first                        |
| `GET /api/admin/audit`                  | Latest admin actions                                   |
| `POST /api/admin/demo/reset`            | Recreate the demo users (only when demo data is on)    |

- **Audit log:** every change an admin makes is written to an append-only audit log, in the **same transaction** as the change. It records who, what, when and the required reason.
- **A frozen account** can't send or receive money (`409 ACCOUNT_NOT_ACTIVE` / `RECIPIENT_NOT_ACTIVE`) until it's unfrozen.

## Performance

Measured on the production build with Lighthouse (simulated mid-range phone on slow 4G):

| Page   | Performance | Accessibility | Best practices | SEO |
| ------ | ----------- | ------------- | -------------- | --- |
| Home   | 83          | 100           | 100            | 100 |
| Log in | 84          | 100           | 100            | 100 |

Startup download: **629 KB raw / 136 KB gzipped** (down from 1.10 MB / 222 KB). What made the difference:

- **`zod/mini` for the shared schemas.** Same rules, written as functions, so bundlers keep only what is used. Zod went from ~450 KB to ~25 KB in the browser. The API keeps full `zod`, and both share Zod's core.
- **`@neobank/web/ui/theme` secondary entry point.** The app shell no longer pulls the whole UI library (forms, chart) into the first download.
- **The step-up dialog loads on demand** (`import()`), together with the forms and modal code it needs.
- **No `/refresh` call for signed-out visitors.** A secret-free `nb_session` hint cookie tells the app whether a session might exist, so it skips a round trip and avoids a console error.
- **Server:**
  - Brotli/gzip compression.
  - Hashed bundles are cached for a year (`immutable`); `index.html` uses `no-cache`, so a deploy is picked up immediately.
  - API responses use `no-store`, so account data never sits in a cache.
- **Preloading:** after the first page renders, the other pages (1–4 KB each) are preloaded.

## API docs

Swagger UI at **`/api/docs`**, and the OpenAPI 3.1 document at `/api/docs/openapi.json`. Both are generated from the same Zod schemas the API validates with, so the docs can't drift from the rules. A test checks that every documented route exists. Swagger UI is served from the app, not a CDN, so it works under the strict Content-Security-Policy.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Checks:** `npm audit --omit=dev --audit-level=high`, format, lint, typecheck (including test files), unit tests and build, for affected projects only.
2. **Browser tests:** the Playwright suite.
3. **Docker:** builds the production image, starts it next to a MongoDB replica set, and runs `tools/smoke.mjs` against it.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs. Angular, Nx and Vitest updates are grouped, because those packages must move together.

`.github/workflows/keep-alive.yml` runs the smoke test against the live app every Monday at 09:00 IST, and on demand from **Actions → Keep alive → Run workflow**. It catches a broken deployment (GitHub emails you when it fails), and the weekly database activity stops Atlas from pausing the free cluster. The URL comes from the repository variable `APP_URL`, defaulting to `https://neobank-sisir.onrender.com`.

## Deploying (Render + MongoDB Atlas, both free)

**1. MongoDB Atlas** ([cloud.mongodb.com](https://cloud.mongodb.com))

1. Create a free account, then a cluster: **M0 (free)**, provider **AWS**, region **Singapore (ap-southeast-1)**, the same region as the Render service.
2. **Database Access → Add user:** for example `neobank_app` with an auto-generated password. Copy it.
3. **Network Access → Add IP address → Allow access from anywhere** (`0.0.0.0/0`). Render's free tier has no fixed outgoing IP. The database stays protected by the user's password and TLS.
4. **Connect → Drivers:** copy the connection string and fill in the password and the database name `neobank`. Percent-encode any special characters in the password:
   `mongodb+srv://neobank_app:<password>@<cluster>.mongodb.net/neobank?retryWrites=true&w=majority`

**2. Render** ([render.com](https://render.com))

1. In `render.yaml`, change `name: neobank` to something unique, such as `neobank-<yourname>`. It becomes `https://<name>.onrender.com`. Commit and push.
2. Sign in with GitHub, then **New → Blueprint** → pick this repository.
3. Render asks for the two secrets:
   - **`MONGODB_URI`:** the Atlas string from step 1.4.
   - **`ADMIN_PASSWORD`:** a strong password for `admin@neobank.dev`, or leave it empty for no admin.

   `JWT_ACCESS_SECRET` and `MFA_ENCRYPTION_KEY` are generated by Render. **Never regenerate `MFA_ENCRYPTION_KEY`**, or existing 2FA setups stop working.

4. **Apply.** The first Docker build takes about 5–10 minutes. The logs should end with `[db] connected` and `[api] ready`.

**3. Check it**

```bash
npm run smoke -- https://<name>.onrender.com
```

`/api/health` shows the deployed git commit as `version`. Log in as the admin and set up 2FA with your phone.

**Free-tier notes**

- **Sleeping:** the service sleeps after 15 minutes without traffic, and the first request after that takes about 30–60 seconds. The smoke test waits for it. To keep it awake, add a free [UptimeRobot](https://uptimerobot.com) monitor on `/api/health` every 5 minutes. One always-on service uses about 744 of the 750 free hours a month.
- **Every push to `main` redeploys automatically.** CI runs in parallel. To deploy only after CI passes, turn on Render's _Auto-Deploy: After CI checks pass_.
- **Atlas M0:** 512 MB storage and no backups. A cluster with no connections for a long time can be paused; the weekly _Keep alive_ workflow prevents that. Reset demo data any time from Admin → **Reset demo data**.

## Roadmap

- [x] Day 1 – Monorepo, API skeleton, DB, themed UI kit, health check, CI, Docker
- [x] Day 2 – Authentication (JWT + refresh cookie)
- [x] Day 3 – Accounts + dashboard
- [x] Day 4 – Transfers, beneficiaries, idempotency
- [x] Day 5 – History, statements, chart, admin, demo data
- [x] Day 6 – Two-step verification, step-up for risky actions, password change, sessions
- [x] Day 7 – Performance, API docs, CI (Playwright + Docker smoke test), deployment setup
