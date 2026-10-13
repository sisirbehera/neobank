# Demo script (about 7 minutes)

A click-through for showing NeoBank to someone, such as in an interview or a review. Each step lists what to click and the one sentence worth saying.

## Before you start

- **Wake the app 2 minutes early:** open https://neobank-sisir.onrender.com. The free plan sleeps after 15 minutes, and waking takes up to a minute.
- **Start from clean demo data:** log in as admin → **Admin → Reset demo data**. Visitors can't change the demo login's password or 2FA, but they can add beneficiaries or move its money around.
- **Two browser windows, side by side:**
  - a normal window, where you'll log in as Priya (`demo@neobank.dev` / `Demo@1234`);
  - a private window, logged in as Ravi (`ravi@neobank.dev` / `Demo@1234`), to receive a payment live.
- **For the 2FA part, prepare your own customer account** the day before: register, open an account, **Add money** (for example ₹50,000), then **Security → Set up** with your phone. The shared demo user can't turn on 2FA: its Security page explains that it's shared.
- Have your phone with the authenticator app, plus your admin password.
- Optional extra tab: https://neobank-sisir.onrender.com/api/docs/

## 1. First impression (45 s)

1. Open https://neobank-sisir.onrender.com. It lands on `/en/` (or `/hi/` if the browser prefers Hindi).
   > "The address says the language. With no language in it, the server picks your saved choice, then your browser's language, then English."
2. Right-click → **View page source**: the heading and text are in the HTML.
   > "Public pages are built to HTML ahead of time, so they show before any JavaScript runs. Angular then takes over the same HTML instead of drawing it again."
3. Use the theme switcher: Light → Dark → Emerald.
   > "Themes are only CSS variables, each checked for contrast. The saved theme is applied before the first paint, so a dark page never flashes white."

## 2. Languages (45 s)

1. **Log in → Fill in → Log in** (Priya).
2. Click **हिन्दी** in the navbar. The same page reloads in Hindi: "नमस्ते, Priya Sharma", "2 खातों में", amounts like ₹12,34,567.89, chart labels like "₹50 हज़ार", Hindi month names.
   > "Each language is its own build, so every string is already in place and a missing translation fails the build. The API stays in English but sends error codes, and the page words the message in its language."
3. Click **English** to switch back. Still signed in, same page.

## 3. Dashboard and money (1 min)

1. Point at the total balance, the account cards and recent activity.
2. Hover over the **Money in and out** chart, press Tab to move through the months, then click **Show table**.
   > "It's plain SVG, with no chart library. Colours are safe for colour blindness, it works with the keyboard, and it has a table view."
3. Open an account → **Add money** → `1,500.50` → confirm. A toast confirms it; the balance and the total update together.
   > "Money is stored as whole paise, never floating point. Every change writes a ledger entry, and the balance always equals the ledger."

## 4. A transfer, and a live notification (1 min 30 s)

1. In Priya's window: **Beneficiaries** → **Pay** next to Ravi Kumar → ₹500 → **Continue** → **Confirm transfer**.
   > "The browser created an Idempotency-Key at the Review step: pressing Confirm twice can't pay twice. The debit, the credit, both ledger entries and the notification to Ravi are saved in one MongoDB transaction."
2. Switch to Ravi's window. A toast says "₹500.00 received from Priya Sharma", and the bell shows **1**.
   > "The app checks for news when the tab comes back into view and once a minute while it's visible. No WebSocket is needed for events where a minute is fine. The notification is stored as a type plus values, so it reads correctly in either language."
3. Open the bell → click the notification: it opens Ravi's account with the new balance.

## 5. History and statement (45 s)

1. Back in Priya's window: **Transactions:** filter by type or money in/out, and type `rent` in search. The URL changes; reload, and the filters are still there.
2. **Export CSV** and open it.
   > "Dates are Indian Standard Time. Text that starts with `=` is escaped, so a spreadsheet won't run it as a formula."

## 6. Security (1 min 30 s)

1. **Log out**, then log in with **your own** account. It asks for the 6-digit code from your phone.
   > "The password alone only earns a 5-minute challenge token. The session starts after the code."
2. **Beneficiaries → add one.** A **Confirm it's you** dialog asks for a fresh code.
   > "Risky actions ask again. One interceptor handles it for every page and retries the original request, keeping its idempotency key."
3. **Security:** show **Where you're signed in** and **Recent security activity**: sign-ins, failed attempts, 2FA and password changes, each with device and IP.
   > "If something here isn't you, change your password. A sign-in from a new browser also sends a notification. After 5 idle minutes the app signs out, with a one-minute warning first, and all open tabs share the activity."

## 7. Admin (45 s)

1. **Log out** → log in as `admin@neobank.dev` with your password and code.
   > "2FA is mandatory for admins, and admin routes check that the session was started with it."
2. **Admin → Users** → open Ravi → **Freeze** one account and enter a reason. In Ravi's window, a notification says the account was frozen.
3. **Overview:** the action appears under **Recent admin actions**.
   > "Every admin change is written to an audit log in the same transaction as the change: who, what, when and why."
4. **Unfreeze** it again, so the demo stays usable.

## 8. Under the hood (30 s, if asked)

- **`/api/docs`:** "These API docs are generated from the same Zod schemas that validate requests and forms, so they can't drift apart."
- **GitHub → Actions:** "Every push runs lint, type checks, about 290 unit tests and 20 browser tests, including the language tests against the production build. It also builds the Docker image and smoke-tests it. Every Monday the live app is smoke-tested too."
- **`docs/decisions/`:** "Each big choice has a short note explaining why: 14 so far."

## Likely questions

| Question                                    | Short answer                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why MongoDB for money?                      | Multi-document transactions on a replica set make it safe. Conditional updates prevent overdrafts ([0003](decisions/0003-mongodb-transactions.md))                                                    |
| Where is the login token stored?            | Access token in memory; refresh token in an HttpOnly, SameSite=Strict cookie that rotates ([0005](decisions/0005-tokens-memory-and-cookie.md))                                                        |
| What if two transfers race the daily limit? | One conditional upsert on a per-day counter; a test fires them in parallel                                                                                                                            |
| Why aren't signed-in pages pre-built?       | The server doesn't know who is asking, and personal data must not end up in cacheable HTML ([0012](decisions/0012-prerender-public-pages.md))                                                         |
| Did pre-rendering make it faster?           | Lighthouse home page 74 → 87 (mobile, slow 4G): layout shift almost gone, blocking time halved. First paint is now limited by the Bootstrap stylesheet, not JavaScript                                |
| Why one build per language?                 | No lookup cost, pre-built pages in every language, and a missing translation fails the build. The price is a page reload when switching ([0013](decisions/0013-built-in-i18n-per-language-builds.md)) |
| Why polling instead of WebSockets?          | A minute's delay is fine for these events, and a sleeping free server would keep dropping connections ([0014](decisions/0014-notifications-polling-type-and-values.md))                               |
| Why is the first load slow?                 | The free hosting plan sleeps after 15 minutes. The app itself loads in about 155 KB                                                                                                                   |
| Is it a real bank?                          | No. Deposits are simulated and no real money or identity data is involved                                                                                                                             |
