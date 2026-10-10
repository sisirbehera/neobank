# Demo script (about 5 minutes)

A click-through for showing NeoBank to someone, such as in an interview or a review. Each step lists what to click and the one sentence worth saying.

## Before you start

- **Wake the app 2 minutes early:** open https://neobank-sisir.onrender.com. The free plan sleeps after 15 minutes, and waking takes up to a minute.
- **Check the demo login works.** If someone changed it, log in as admin → **Admin → Reset demo data** (see the [runbook](runbook.md)).
- **For the 2FA part, prepare your own customer account** the day before: register, open an account, **Add money** (for example ₹50,000), then **Security → Set up** with your phone. Never turn on 2FA for the shared demo user: it would lock out every other visitor.
- Have your phone with the authenticator app, plus your admin password.
- Optional second tab: https://neobank-sisir.onrender.com/api/docs/

## 1. First impression (30 s)

1. Open the home page. Use the theme switcher in the navbar: Light → Dark → Emerald.
   > "One Angular app with a small UI library on top of Bootstrap. Themes are only CSS variables, and each one is checked for contrast."
2. Go to **Log in → Fill in → Log in** (Priya, the demo customer).

## 2. Dashboard and money (1 min)

1. Point at the total balance, the account cards and recent activity.
2. Hover over the **Money in and out** chart, then press Tab to move through the months, then click **Show table**.
   > "It's plain SVG, with no chart library. Colours are safe for colour blindness, it works with the keyboard, and it has a table view. Transfers between your own accounts are left out, because they're neither income nor spending."
3. Open an account → **Add money** → `1,500.50` → confirm. The balance and the dashboard total update together.
   > "Money is stored as whole paise, never floating point. Every change writes a ledger entry, and the balance always equals the ledger."

## 3. A transfer (1 min)

1. **Beneficiaries** → **Pay** next to Ravi Kumar.
2. Enter ₹500 → **Continue** → read the **Review** screen → **Confirm transfer**.
   > "The browser created an Idempotency-Key when I reached Review. If the network drops and I press Confirm again, the server replays the first result instead of paying twice. The debit, the credit, both ledger entries and that key are saved in one MongoDB transaction: either all of it happens or none of it does."
3. Optional: **Make another transfer** between Priya's own two accounts. The total stays the same.

## 4. History and statement (45 s)

1. **Transactions:** filter by type or money in/out, and type `rent` in search. Notice that the URL changes; reload, and the filters are still there.
2. **Export CSV** and open it.
   > "Dates are Indian Standard Time. Text that starts with `=` is escaped, so a spreadsheet won't run it as a formula."

## 5. Two-step verification and step-up (1 min)

1. **Log out**, then log in with **your own** account. It asks for the 6-digit code from your phone.
   > "The password alone only earns a 5-minute challenge token. The session starts after the code."
2. **Beneficiaries → add one.** A **Confirm it's you** dialog asks for a fresh code.
   > "Risky actions ask again. One Angular interceptor handles it for every page and retries the original request, keeping its idempotency key."
3. Optional: pay that beneficiary more than ₹10,000, and the dialog appears again.
4. **Security:** show the devices list with **This device**.

## 6. Admin (45 s)

1. **Log out** → log in as `admin@neobank.dev` with your password and code.
   > "2FA is mandatory for admins, and admin routes check that the session was started with it."
2. **Admin → Users** → open Ravi → **Freeze** one account and enter a reason.
3. **Overview:** the action appears under **Recent admin actions**.
   > "Every admin change is written to an audit log in the same transaction as the change, with who, what, when and why."
4. **Unfreeze** it again, so the demo stays usable.

## 7. Under the hood (30 s, if asked)

- **`/api/docs`:** "These API docs are generated from the same Zod schemas that validate requests and forms, so they can't drift apart."
- **GitHub → Actions:** "Every push runs lint, type checks, about 230 unit tests, browser tests, and builds the Docker image and smoke-tests it. Every Monday the live app is smoke-tested too."
- **`docs/decisions/`:** "Each big choice has a short note explaining why."

## Likely questions

| Question                                    | Short answer                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why MongoDB for money?                      | Multi-document transactions on a replica set make it safe. Conditional updates prevent overdrafts ([0003](decisions/0003-mongodb-transactions.md)) |
| Where is the login token stored?            | Access token in memory; refresh token in an HttpOnly, SameSite=Strict cookie that rotates ([0005](decisions/0005-tokens-memory-and-cookie.md))     |
| What if two transfers race the daily limit? | One conditional upsert on a per-day counter; a test fires them in parallel                                                                         |
| Why is the first load slow?                 | The free hosting plan sleeps after 15 minutes. The app itself loads in about 136 KB                                                                |
| Is it a real bank?                          | No. Deposits are simulated and no real money or identity data is involved                                                                          |
