# Learning log

What each day built, the concepts it taught, and the bugs we hit along the way. The bugs are the most useful part: each one is a mistake that's easy to make again.

## Week 1 at a glance

| Day | Built                                                           | Unit tests | Browser tests |
| --- | --------------------------------------------------------------- | ---------- | ------------- |
| 1   | Nx workspace, health check, UI library with 3 themes            | 21         | 2             |
| 2   | Register, login, rotating refresh cookie                        | 61         | 4             |
| 3   | Accounts, deposits and withdrawals with a ledger, dashboard     | 104        | 5             |
| 4   | Transfers, beneficiaries, idempotency keys, daily limit         | 133        | 7             |
| 5   | History, CSV statements, chart, admin with audit log, demo data | 177        | 9             |
| 6   | Two-step verification, step-up, password change, sessions       | 222        | 10            |
| 7   | Performance, API docs, CI, deployment                           | 231        | 10            |

Live since 2026-10-09 at https://neobank-sisir.onrender.com.

---

## Day 1: foundations

**Built:** the Nx workspace (`apps/api`, `apps/web`, `apps/web-e2e`, three libraries), Express with security headers and one error format, environment variables checked by Zod at start-up, an in-memory MongoDB replica set for development, the `nb-*` UI library with Light, Dark and Emerald themes, and the first SignalStore.

**Concepts**

- **Monorepo boundaries:** Nx tags plus a lint rule make "the web app must not import API code" a build error, not a code-review comment.
- **Validate config at start-up:** a missing secret should stop the server immediately, not fail on the first login hours later.
- **A replica set even in development:** transactions need one, so `mongodb-memory-server` starts a one-node replica set and local behaviour matches Atlas.

**Watch out:** Zod made the first page about 80 KB (gzipped) heavier. We noted it and fixed it on Day 7, after measuring.

## Day 2: authentication

**Built:** register, login, refresh, logout and `me`; `scrypt` password hashing; lockout after 5 failures; an `AuthStore`; an interceptor that attaches the token and refreshes once on `401`, sharing one refresh between parallel requests; reusable form fields that show API errors under the right input.

**Concepts**

- **Access vs refresh tokens:** a short-lived JWT in memory plus a long-lived opaque token in an `HttpOnly` cookie ([0005](decisions/0005-tokens-memory-and-cookie.md)).
- **Rotation and reuse detection:** a refresh token works once; seeing an old one again suggests theft.
- **Same error for "wrong password" and "unknown email"**, so attackers can't discover which emails are registered.

**Bug:** Nx's `typecheck` target skipped test files, so a type error in a spec went unnoticed. **Lesson:** check what your checks actually check. Fixed on Day 6 by running `tsc` on the spec config too.

## Day 3: accounts and the ledger

**Built:** account numbers with a Luhn check digit, opening accounts, deposits and withdrawals, the transaction + ledger-entry model, the dashboard and account pages, `AccountsStore` with entities.

**Concepts**

- **Money as integer paise** and parsing `"1,500.50"` digit by digit, never with `parseFloat` ([0002](decisions/0002-money-as-integer-paise.md)).
- **Conditional atomic updates:** "debit where `balance >= amount`" can't overdraw, even with five withdrawals at the same moment. "Read the balance, check it, then write" can.
- **404, not 403, for someone else's account:** don't confirm that it exists.

**Test that proves it:** five concurrent ₹30 withdrawals from ₹100 give exactly three successes and a ₹10 balance.

## Day 4: transfers and idempotency

**Built:** transfers in one MongoDB transaction, beneficiaries, a reusable idempotency helper, a ₹2,00,000 daily limit, and a two-step transfer page.

**Concepts**

- **Idempotency keys**, recorded in the same transaction as the money movement ([0004](decisions/0004-idempotency-keys.md)).
- **Enforcing a limit under concurrency** with one conditional upsert and a unique index, rather than "read the total, then write".
- **Who can be paid** as a business rule: your own accounts or saved beneficiaries only.

**Bugs the browser tests caught**

1. **The rate limiter logged people out.** Refresh, which every page load calls, shared the strict login limit of 20 requests per 15 minutes. Busy users, or a whole office behind one IP address, got logged out. **Fix:** refresh gets 10× the limit. **Lesson:** a security control on the wrong endpoint becomes an outage.
2. **Lost responses looked like token theft.** If the browser lost the response carrying the new cookie (tab closed mid-request, two tabs refreshing together), its next refresh reused the old token and logged the user out everywhere. **Fix:** a 30-second grace period after rotation. **Lesson:** design for the network losing any response.

## Day 5: history, statements, admin

**Built:** filtered and paged history in IST, CSV statements, the money in/out chart, seven admin endpoints with an audit log written in the same transaction, and demo users with six months of history.

**Concepts**

- **Time zones:** "today" and "this month" mean IST, so dates are grouped with `timezone: 'Asia/Kolkata'`.
- **CSV injection:** a cell starting with `=` can run as a spreadsheet formula, so such cells are prefixed with `'`.
- **Escape user input before using it in a regex** (search).
- **Audit logs** belong in the same transaction as the change they describe.
- **Accessible charts:** colours validated for colour blindness, separate dark-mode steps, a legend, keyboard tooltips, a table view ([0010](decisions/0010-svg-chart.md)).

**Bugs a screenshot review caught**

1. **Dark-theme contrast failed.** White text on the light-blue buttons was 3.0:1, below the 4.5:1 minimum. **Fix:** two tokens, `--nb-primary` for text and `--nb-primary-solid` for filled surfaces (4.94:1). **Lesson:** a colour that works as text often fails as a background.
2. **The chart tooltip covered the column being read.** It now sits beside it.
3. **The search box shrank to a few pixels** on desktop. The filters were rearranged into two rows.
4. **Copying `.env.example` to `.env` would have crashed the API**, because `ADMIN_PASSWORD=` (empty) failed validation. **Fix:** empty means "not set", with a test that loads the real `.env.example`. **Lesson:** test the path a new developer actually takes.

## Day 6: two-step verification

**Built:** TOTP on Node's `crypto`, AES-256-GCM secret storage, backup codes, two-step sign-in, mandatory admin enrolment, step-up for risky actions through one interceptor, password change and a devices list.

**Concepts**

- **TOTP in about 100 lines**, tested against the RFC's own test vectors ([0006](decisions/0006-totp-and-step-up.md)).
- **JWT audiences:** challenge, step-up and access tokens are signed with the same secret but can't be swapped for one another.
- **Step-up as a protocol** (`403` + `meta.action` → code → retry), so pages need no changes.
- **Encryption keys are forever:** changing `MFA_ENCRYPTION_KEY` locks out everyone with 2FA.

**Bug fixed in Day 2's design:** any revoked refresh token triggered "log out everywhere", so a device you had signed out could log you out everywhere just by retrying. **Fix:** only a reused _rotated_ token counts as theft. **Lesson:** "revoked" has several causes, and only one of them means an attack.

## Day 7: performance and deployment

**Built:** `zod/mini` schemas, a theme-only entry point for the UI library, a lazy step-up dialog, the `nb_session` hint cookie, compression and cache headers, database indexes, OpenAPI docs at `/api/docs`, CI with Playwright and a Docker smoke test, Dependabot, the smoke script, and the Render + Atlas deployment.

**Concepts**

- **Measure before optimising:** the bundle analysis showed Zod was nearly half the startup JavaScript ([0009](decisions/0009-zod-mini.md)). Startup download went from 222 KB to 136 KB gzipped, and Lighthouse reached 83–84 for performance and 100 for accessibility, best practices and SEO.
- **Cache rules:** hashed files for a year, `index.html` never, API responses never (`no-store`).
- **Docs generated from the validation schemas** can't drift from the real rules.
- **Smoke tests** check a running copy the way a user would: in CI against the Docker image, and against the live app.

**Bugs**

1. **The "cache for a year" pattern matched no files.** It allowed only upper-case hashes, but Angular's file names use lower case and `-`. **Lesson:** test a pattern against real file names, not imagined ones.
2. **The Angular 22.2 update broke component tests** (`cache.has is not a function`) until the Analog Vitest plugin was updated to 2.8.0. **Lesson:** packages that hook into the framework must move with it.
3. **Two flaky browser tests were races in the tests, not the app:** Playwright waited for the dev server but not the API, and one test navigated before logout had finished. **Lesson:** wait for the condition you need, not for something that usually comes first.
4. **Lazy-loading the whole ng-bootstrap package made the bundle bigger** (883 KB). Lazy-loading only the dialog module fixed it. **Lesson:** check the build output after every "optimisation".

## After launch

- **The Day 6 commit had the Day 5 message.** We reworded it, then pushed with `git push --force-with-lease`, which refuses to overwrite commits you haven't seen. The old run stays in the Actions history until deleted by hand.
- **A Dependabot PR failed:** it bumped `@vitest/ui` to 5 alone, while it requires exactly the same `vitest` version. **Fix:** group `vitest` and `@vitest/*`, and skip Vitest major versions until the Analog plugin supports them.
- **Atlas region:** Mumbai has no free tier, and Singapore is better anyway: the database should sit next to the server, and Render has no India region.
- **Keeping the free tier alive:** a weekly GitHub Actions workflow smoke-tests the live app, which also keeps the Atlas cluster active.
- **Open issue:** visitors can change the shared demo user's password or turn on its 2FA, locking others out. The recovery is in the [runbook](runbook.md); a proper fix is planned for Day 8.
