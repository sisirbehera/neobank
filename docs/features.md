# Features and API reference

Each feature's endpoints and the rules behind them. For how the pieces fit together, see [architecture.md](architecture.md). The live, always-current list of endpoints is Swagger UI at `/api/docs`.

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

Codes come from any authenticator app (TOTP, RFC 6238, implemented with Node's `crypto` in [`lib/totp.ts`](../apps/api/src/lib/totp.ts)). 2FA is **optional for customers** and **mandatory for admins**.

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
| `GET /api/security/activity`                | Recent sign-ins and security changes (newest 30)               |

- **Two steps:** with 2FA on, the password alone only earns a 5-minute challenge token (a JWT with its own audience, so it can't be used as an access token). The session starts after a correct code.
- **Admins:** an admin without 2FA gets `method: "ENROLL"` and must set it up before getting in. `/api/admin/*` also checks the access token's `mfa` claim.
- **Step-up for risky actions:** adding a beneficiary, and transfers to other people above ₹10,000, answer `403 STEP_UP_REQUIRED` (`meta.action`). The web app's `stepUpInterceptor` asks for a code, gets a step-up token and retries the same request with `X-Step-Up-Token`. Retries keep their Idempotency-Key. Transfers between your own accounts never need a code, and users without 2FA are never asked (they have no code to give).
- **Storage:**
  - the TOTP secret is AES-256-GCM encrypted (`MFA_ENCRYPTION_KEY`);
  - backup codes are SHA-256 hashed and single-use;
  - `lastUsedStep` stops a code from being used twice.
- **Lockout:** wrong passwords, codes and step-up codes share one counter (5 tries → locked for 15 minutes).
- **Shared demo accounts:** the seeded demo users are flagged `demo: true` (also returned as `user.demo`). Changing their password, turning on 2FA and signing out other devices answer `403 DEMO_ACCOUNT`; their devices list shows only the caller's own session; and wrong passwords never lock them (the per-IP rate limit still applies). Otherwise one visitor could lock out everyone else.
- **Sessions:** the access token carries the session id (`sid`), so the API knows which device is "this device". Signing a device out stops its refresh. Its current access token expires within 15 minutes.
- **Security activity:** a `securityevents` row is written for each new sign-in (not each token refresh), failed sign-in (wrong password or code), lockout, password change, 2FA on/off, new backup codes, devices signed out, and a blocked copied refresh token. Each row keeps the device, IP and session; rows expire after 90 days (TTL index). A demo login sees only its own session's rows, so failed attempts and other visitors' IPs stay hidden.

## In the browser

- **Idle logout:** after 5 minutes without a click, key press, scroll or touch, the app signs out and says why. A warning with a countdown and a "Stay signed in" button appears in the last minute. The last-activity time is shared through `localStorage` (`nb_last_active`, a timestamp), so activity in any tab keeps all tabs signed in: they share one session. This is a convenience on the client; the server's own limits (15-minute access token, 7-day refresh token) still apply.
- **Toasts** (`ToastService`, rendered by `<nb-toasts>` in the shell): short messages about something that already happened, such as a deposit, a new account, a device signed out, or being logged out. They hide after 5 seconds, but not while hovered or focused; errors stay until closed; at most 3 show at once. Errors are announced at once by screen readers, the rest politely. Form errors and results the user must act on stay as alerts next to the form.
- **404 page:** unknown addresses show "Page not found" with the address and a way back, instead of silently going to the home page.

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

Startup download: **629 KB raw / 136 KB gzipped** after Day 7 (down from 1.10 MB / 222 KB). Day 8 added toasts and idle logout to the shell (139 KB), Day 9 hydration and event replay (149 KB), and Day 10 the language switcher and the translation tables and hydration of translated components (**154 KB**, the same for each language). What made the difference on Day 7:

- **`zod/mini` for the shared schemas.** Same rules, written as functions, so bundlers keep only what is used. Zod went from ~450 KB to ~25 KB in the browser. The API keeps full `zod`, and both share Zod's core.
- **`@neobank/web/ui/theme` secondary entry point.** The app shell no longer pulls the whole UI library (forms, chart) into the first download.
- **The step-up dialog loads on demand** (`import()`), together with the forms and modal code it needs.
- **No `/refresh` call for signed-out visitors.** A secret-free `nb_session` hint cookie tells the app whether a session might exist, so it skips a round trip and avoids a console error.
- **Server:**
  - Brotli/gzip compression.
  - Hashed bundles are cached for a year (`immutable`); `index.html` uses `no-cache`, so a deploy is picked up immediately.
  - API responses use `no-store`, so account data never sits in a cache.
- **Preloading:** after the first page renders, the other pages (1–4 KB each) are preloaded.

### Pre-built pages (Day 9)

Home, log in and register are rendered to HTML at build time, so they appear before any JavaScript runs, even with JavaScript off. Signed-in pages are rendered in the browser. Details and trade-offs: [0012](decisions/0012-prerender-public-pages.md).

| Address                     | File the API sends                                        |
| --------------------------- | --------------------------------------------------------- |
| `/en/`, `/hi/`              | `en/index.html`, `hi/index.html` (pre-built home page)    |
| `/en/login`, `/hi/register` | `en/login/index.html`, `hi/register/index.html`, …        |
| any other `/en/…`, `/hi/…`  | that language's `index.csr.html` (empty shell)            |
| no language (`/`, `/login`) | a `302` to the visitor's language, keeping path and query |

### Week 1 vs Week 2 (Day 12)

Both versions measured the same way on the same day: the production Docker image with MongoDB, Lighthouse 12.8.2, mobile with simulated slow 4G, median of 3 runs. (Absolute scores differ from the Day 7 table above, which used another machine state; compare within this table only.)

| Page            | Version | Performance | FCP   | LCP   | TBT    | CLS   | Downloaded |
| --------------- | ------- | ----------- | ----- | ----- | ------ | ----- | ---------- |
| Home            | Week 1  | 74          | 2.7 s | 3.9 s | 285 ms | 0.139 | 274 KB     |
| Home (`/en/`)   | Week 2  | **82**      | 2.9 s | 3.7 s | 147 ms | 0.058 | 312 KB     |
| Home (`/hi/`)   | Week 2  | 81          | 2.9 s | 3.9 s | 159 ms | 0.059 | 317 KB     |
| Log in          | Week 1  | 81          | 2.7 s | 3.5 s | 207 ms | 0.087 | 274 KB     |
| Log in (`/en/`) | Week 2  | **85**      | 2.9 s | 3.6 s | 65 ms  | 0.026 | 312 KB     |
| Log in (`/hi/`) | Week 2  | 81          | 3.0 s | 3.8 s | 198 ms | 0.026 | 316 KB     |

Accessibility, best practices and SEO are 100 on every page, in both weeks and both languages.

**What pre-rendering changed, and what it didn't:**

- **Layout shift fell by more than half** (home 0.139 → 0.058). In Week 1 the page was drawn by JavaScript, and the footer jumped down as content appeared. Now the HTML arrives complete.
- **Blocking time roughly halved** (home 285 → 147 ms, log in 207 → 65 ms). Hydration reuses the HTML instead of building every element.
- **The largest element waits less for JavaScript.** The intro paragraph's render delay in the unthrottled trace fell from 1,013 ms to 379 ms.
- **First paint did not get faster** (2.7 → 2.9 s). The browser can't paint anything until the 34 KB Bootstrap stylesheet has loaded, however complete the HTML is, and 89% of that stylesheet is unused on these pages. That, not JavaScript, now limits the first paint.
- **The page downloads more** (+38 KB): the bigger HTML, hydration and the week's features.

**Fixed afterwards:** the remaining layout shift (0.058) came from the System status card, which grew from one line to four when `/api/health` answered. It now always shows its four rows, with grey "Checking…" placeholders while it waits. Re-measured the same way: CLS 0.001 (English) and 0.000 (Hindi), and performance 87 and 83 on the home page.

**What's left:** the render-blocking stylesheet (~300 ms of first paint). Load only the Bootstrap parts the app uses (Sass partials instead of the whole `bootstrap.min.css`), or inline the critical CSS. Angular's built-in critical-CSS inlining is switched off because its `onload` attribute is blocked by our CSP (`script-src-attr 'none'`).

## Notifications

| Endpoint                           | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `GET /api/notifications`           | Newest 20 and the unread count                  |
| `GET /api/notifications/summary`   | Unread count and newest id (what the app polls) |
| `POST /api/notifications/:id/read` | Mark one as read (`404` for someone else's)     |
| `POST /api/notifications/read-all` | Mark all as read                                |

- **What creates one:** money received from someone else (in the transfer's transaction; not for transfers between your own accounts), a sign-in from a browser not seen in the last 90 days (not the first sign-in), password and 2FA changes, a lockout, a blocked copied sign-in, and the bank freezing or unfreezing an account.
- **Stored as a type and values** (`MONEY_RECEIVED` + `{ amountPaise, from, accountId, account }`); the web app words it in the page's language. Details: [0014](decisions/0014-notifications-polling-type-and-values.md).
- **The bell** in the navbar shows the unread count; its list marks items read when opened and links to the account or the Security page. It is loaded with `@defer (on idle)`, so signed-out visitors never download it.
- **New ones appear as toasts.** The app checks the summary on start, when the tab becomes visible, and every 60 seconds while it is visible. Only notifications that arrived since the page loaded become toasts (at most 3 at once). Money received or an account frozen also refreshes the cached balances.
- **The shared demo login** gets no sign-in or security notifications (they would show visitors each other's devices).
- Rows expire after 90 days.

## Languages

English and Hindi, with the language in the address: `/en/dashboard`, `/hi/dashboard`. Details and trade-offs: [0013](decisions/0013-built-in-i18n-per-language-builds.md).

- **Built in, at build time.** Angular's `@angular/localize` produces one complete app per language. A missing Hindi translation fails the build. Customer screens are translated; admin screens are English-only.
- **Which language you get:** an address without a language redirects to the `nb_lang` cookie's language, else the first supported language in the browser's `Accept-Language`, else English.
- **Switching** (the English / हिन्दी link in the navbar) opens the same page in the other language and remembers the choice: in the cookie on this device, and on the profile for signed-in users (`PATCH /api/auth/me` with `{ "language": "hi" }`). The session survives the page reload.
- **The last explicit choice wins.** After signing in on a device that never chose, the profile's language applies. The profile's language is empty until the user chooses (the switcher, or the page they registered on). The shared demo login's profile can't be changed (`403 DEMO_ACCOUNT`).
- **Errors:** the API keeps English messages, but each error has a `code`, plus numbers in `meta` where the message has them (`ACCOUNT_LOCKED` → `minutes`, `DAILY_LIMIT_EXCEEDED` → `limitPaise`, `ACCOUNT_NOT_ACTIVE` → `status`). The browser words them in its language. Validation messages from the shared schemas are translated by their English text (`core/i18n/messages.ts`); a unit test fails if a schema message has no translation.
- **Formatting follows the language:** amounts with `formatInr(paise, locale)`, dates with Angular's date pipe, chart months with `Intl`. Both languages use lakh/crore grouping and Latin digits (`₹12,34,567.89`); short chart labels read "₹85K / ₹1.2L" in English and "₹85 हज़ार / ₹1.2 लाख" in Hindi.

## API docs

Swagger UI at **`/api/docs`**, and the OpenAPI 3.1 document at `/api/docs/openapi.json`. Both are generated from the same Zod schemas the API validates with, so the docs can't drift from the rules. A test checks that every documented route exists. Swagger UI is served from the app, not a CDN, so it works under the strict Content-Security-Policy.
