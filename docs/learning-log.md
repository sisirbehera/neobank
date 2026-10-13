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
- **The shared demo login could be hijacked.** Any visitor could change its password or turn on its 2FA and lock everyone else out, or lock it for 15 minutes by typing wrong passwords; its devices list also showed other visitors' IP addresses. Found while writing the runbook, fixed first thing on Day 8 with a `demo` flag on the user. **Lesson:** a shared account is a different kind of user, and every "protect the account" feature can be turned against the people sharing it.

## Day 8: polish

**Built:** a security activity list (API and Security page), toasts, idle logout with a warning, and a 404 page.

**Concepts**

- **An activity log is not an audit log.** The admin audit log records what staff changed, for the bank. Security activity is the customer's own history, written for them: "was that sign-in me?". It records new sign-ins only, not every token refresh, or the list would be noise. Rows expire after 90 days through a TTL index, the same mechanism that deletes expired refresh tokens.
- **The shared demo login, again:** a list of failed sign-ins with IP addresses would show every visitor the others' attempts. A demo login sees only its own session's rows. Every new screen that lists "your" data needs that check.
- **Idle logout across tabs:** all tabs share one sign-in, so a forgotten tab must not sign you out while you work in another. The tabs share a last-activity timestamp in `localStorage`, and each compares the time elapsed instead of counting timer ticks, because browsers slow timers in hidden tabs and laptops sleep.
- **Testing time without waiting:** Vitest fake timers move the clock in unit tests, and Playwright's `page.clock.fastForward('04:01')` does the same in a real browser. Five minutes of idling runs in under a second.
- **Accessible toasts:** two live regions, so errors interrupt a screen reader and the rest wait their turn. A toast doesn't vanish while hovered or focused, and errors stay until closed.

**Bugs**

1. **Mocking `Date.now` doesn't change `new Date()`.** A test for stolen-token detection moved a fake clock forward, but the server compares `new Date()` values, so the grace period never ended. **Fix:** backdate `rotatedAt` in the database, as the existing auth tests do. **Lesson:** know which clock the code under test actually reads.
2. **A spied router still navigates.** `vi.spyOn(router, 'navigateByUrl')` calls the real method, which failed on a route the test router doesn't have. **Fix:** `.mockResolvedValue(true)`. **Lesson:** a spy watches, a mock replaces; pick the one you mean.
3. **The 404 page could show the previous address.** `Router.url` can still hold the old URL while the new page is being created. **Fix:** read the unknown path from the matched route's own segments (`ActivatedRoute.snapshot.url`).
4. **An empty `role="alert"` broke an unrelated test.** The toast area is a permanent live region (screen readers only announce changes to a region they already know), and giving it `role="alert"` meant every page now had an extra, empty alert. A login test looking for "the alert" found two. **Fix:** `aria-live` on the regions, no role. **Lesson:** landmarks and roles are an API that both screen readers and tests rely on, so add them on purpose.

## Day 9: rendering where it helps

**Built:** home, log in and register pre-built at build time and hydrated in the browser; signed-in pages still rendered in the browser; the API serving each address its file and allowing the pages' inline scripts by hash ([0012](decisions/0012-prerender-public-pages.md)).

**Concepts**

- **Render modes are chosen per route.** _Prerender_ builds HTML once at build time, _Server_ renders on every request, _Client_ renders in the browser. A page that is the same for everyone suits Prerender. A banking page doesn't: the server doesn't know who is asking, and personal data must not end up in cacheable HTML.
- **Hydration** reuses the server's HTML instead of drawing the page again. Angular attaches its listeners and state to the existing elements. If the browser's first render differs from the HTML (a different `@if` branch, for example), Angular replaces that part.
- **Event replay** records clicks and typing made before the JavaScript arrives, and replays them once Angular is ready.
- **Static output needs no server.** With `outputMode: "static"` the build writes plain files: one per pre-built page, plus `index.csr.html` for the rest. The existing Express app serves them.
- **CSP hashes instead of `'unsafe-inline'`.** A hash allows one exact script. The API computes them from the built pages at startup, so they can't drift from the build.
- **Code that runs while a page is being built must not touch browser-only APIs.** Session restore, the health check and timers are skipped there (`isPlatformBrowser`, `afterNextRender`).

**Bugs a slow-network test caught**

1. **Text typed before Angular loaded was wiped.** The form is visible early, so people can type into it. When Angular takes over, each form control writes its starting value (empty) into the field. **Fix:** the shared `nbInput` directive reads the field before that happens and puts the text back into the form.
2. **An early click on "Log in" reloaded the page.** Before Angular has loaded, nothing stops the browser's own form submission (`GET /login?`). Event replay records the click but doesn't prevent the default action. **Fix:** the early script in `index.html` blocks native submits; Angular, which handles every form, gets the replayed submit. **Lesson:** test the gap between "visible" and "working". Holding back `main.js` in Playwright makes it easy to reproduce.
3. **Signed-in visitors saw "Log in" buttons flash.** Pages are built signed out. **Fix:** the early script reads the `nb_session` hint cookie and hides signed-out buttons until Angular knows the answer.
4. **Changing the early script broke nothing locally, but would have broken the live site** if the CSP hashes had been fixed in configuration. Computing them at startup, plus a smoke test that checks every inline script against the CSP, closes that gap.
5. **The browser tests failed for reasons outside the code.** Playwright reused a dev server left running from the night before, which predated the SSR setup. Its API's sign-in rate-limit counter had also filled up across many runs, so registration got `429`. **Lesson:** when tests fail in a way the change can't explain, check what is actually serving the requests.

## Day 10: English and Hindi

**Built:** the customer screens in English and Hindi, under `/en/` and `/hi/`; a language switcher that keeps the page; the choice remembered on the device and on the profile; amounts, dates and chart labels per language; API and validation errors in the page's language ([0013](decisions/0013-built-in-i18n-per-language-builds.md)).

**Concepts**

- **Compile-time vs runtime translation.** Angular's built-in i18n bakes each language into its own build; libraries like Transloco look strings up while the app runs. Built-in means no lookup cost, pre-built pages in every language for free, and a build that fails on a missing translation. The price is a page reload when switching.
- **Messages have IDs derived from their text.** `extract-i18n` collects every `i18n` attribute and `$localize` string into `messages.json`. Changing the English changes the ID, so the old translation stops matching, and the strict build says so.
- **Placeholders and plurals.** A message keeps markup and values as placeholders (`{$START_LINK}`, `{$INTERPOLATION}`), so a translator can move them, as Hindi word order needs: "{$system} पर {$browser}". Counts use ICU plural syntax, `{n, plural, =1 {…} other {…}}`, because each language has its own plural rules.
- **Codes and data for programs, messages for people.** The API keeps English messages for logs and the API docs. Each error also carries a code and, where needed, numbers in `meta`, and the browser writes the sentence in its language.
- **Locale-aware formatting comes from `Intl`.** Hindi keeps Latin digits and lakh grouping, and has its own short forms: "₹85 हज़ार", "₹1.2 लाख". `Intl` puts a non-breaking space in "85 हज़ार", so the two parts never split across lines.
- **The last explicit choice wins.** A device choice (cookie) beats the profile, and the profile beats the browser's default. A default must never be stored as if it were a choice.

**Bugs**

1. **Importing one function pulled the whole UI library into the first download (+17 KB).** `registerValidationMessages` came from `@neobank/web/ui`'s main entry, which also exports the chart and the forms. **Fix:** a second tiny entry point, `@neobank/web/ui/messages`, as Day 7 did for the theme. **Lesson:** read the bundle report after adding an import to the app shell.
2. **Hydration silently stopped.** After the templates were marked for translation, Angular hydrated 0 components and redrew every page, so text typed before loading was lost again. Components with `i18n` blocks are only hydrated with `withI18nSupport()`. A slow-network browser test caught it; the console message "hydrated 0 component(s)" confirmed it.
3. **A profile default would have overridden real choices.** Every user's language defaulted to `en`, so a Hindi visitor who never chose would be switched to English after signing in, including everyone on the shared demo login. **Fix:** the profile's language stays empty until the user chooses.
4. **Two test servers shared one build folder.** The production test server built the API into `apps/api/dist`, where the dev API runs from. The dev API restarted on every such build and lost its in-memory database, so random registrations failed. **Fix:** an `e2e` build configuration with its own output folder. The esbuild executor's `--outputPath` override moved only `package.json`, not `main.js`, which is why it needed a named configuration.
5. **Unit tests use Angular's default locale, `en-US`,** which formats ₹12,34,567 as ₹1,234,567. The app is built for `en-IN`, so the tests now set `LOCALE_ID` explicitly. Tests also load `@angular/localize/init`, which the app gets from its polyfills.

## Day 10, follow-up: readable message IDs

**Changed:** every message now has a hand-picked ID (`login.title`, `transfer.confirm`, `error.invalidCredentials`) instead of a generated number, after reviewing the Hindi showed that `"6972903818043702698": "लॉग इन · NeoBank"` says nothing about where a line appears.

**Concepts**

- **Generated vs custom IDs.** Angular's default ID is a hash of the English text (plus its meaning). It needs no naming, and any English change forces a new translation. Custom IDs (`@@login.title`) are readable and stable: a typo fix in English keeps its Hindi. The cost is that stale translations are no longer caught by the build, so a test checks the files instead.
- **Renaming 315 messages safely.** The XLIFF export records the file and line of every message. A script named each one from its file and text (hand-picked names for about 180), inserted `@@id` at that spot, re-extracted, and moved each Hindi translation only if the English behind the old and the new ID was identical. All 314 matched.
- **A plural alone in its element is one message.** With text or line breaks around it, Angular extracts a wrapper (`{$ICU}`) plus the plural, and the plural can't get a custom ID. Prettier puts line breaks back, so the element carries `<!-- prettier-ignore -->`.

**Bugs**

1. **The first rename attempt attached some IDs to the wrong elements.** It took the first matching `label=` near a line, and its search window didn't reach tags that start more than six lines above their text. Every match now has to agree with the message text, and a final check compares all IDs and texts against the plan.
2. **A `Copy / Copied` button was never translated** (a `'Copied' : 'Copy'` string inside a template expression). Found while reading the rename diff.
3. **A build "failed" because the terminal's working folder was inside `dist/`.** Windows won't delete a folder a program is using. Not a project problem, but worth recognising.

## Day 11: notifications

**Built:** in-app notifications for money received, sign-ins from new devices, security changes and frozen accounts; a bell with an unread badge in the navbar; toasts for new ones ([0014](decisions/0014-notifications-polling-type-and-values.md)).

**Concepts**

- **Store facts, not sentences.** A notification is `MONEY_RECEIVED` plus `{ amountPaise, from, account }`. The browser words it in the reader's language and formats the amount for it. The same row reads correctly in English and Hindi, and the wording can change later.
- **Write the side effect in the same transaction.** The "money received" notification is created inside the transfer's MongoDB transaction: if the transfer rolls back, so does the notification. There is never a notification for money that didn't arrive.
- **Polling, designed to be cheap.** One tiny summary request (unread count + newest id) per minute while the tab is visible, plus one when it becomes visible again. The full list is fetched only when the newest id changes. For events where a minute's delay is fine, this is simpler and sturdier than WebSockets on a server that sleeps.
- **Only new things become toasts.** The first check after loading just records the newest id; older unread notifications show in the badge, not as a burst of toasts.
- **`@defer` keeps optional UI out of the first download.** The bell is only for signed-in users, so it loads in its own 3 KB chunk once the browser is idle.
- **One event can make cached data stale.** Money arriving changes a balance the app had cached. Notifications that change an account now refresh the accounts store, and the account page reloads its list when that account's balance or status changes.

**Bugs**

1. **The account page kept showing the old balance** after money arrived, even after clicking the notification: the router doesn't reload a page it is already on, and the balance came from a cache. The new browser test (two users in two browsers, the receiver's clock fast-forwarded a minute) caught it.
2. **MongoDB can't index "field doesn't exist".** A partial index with `readAt: { $exists: false }` is rejected. An ordinary index on `(userId, readAt)` works, because a missing field is indexed as null, and the query uses `readAt: null`.
3. **Mongoose refuses update pipelines unless asked** (the `updatePipeline` option). A plain conditional update (`readAt: null` in the filter) was clearer anyway.
4. **Still open: one browser test failed once in four full runs** (a registration that didn't reach the dashboard). It didn't reproduce, not even with registration under load or submitted before Angular loaded. CI retries failed tests and records a trace, so a repeat there will show what happened.
