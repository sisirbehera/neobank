# 0014. In-app notifications: stored as type and values, fetched by polling

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Customers should hear about things that happened while they weren't looking: money arriving, a sign-in from a new device, a security change, the bank freezing an account. The app runs on a free Render instance that sleeps after 15 minutes, in two languages ([0013](0013-built-in-i18n-per-language-builds.md)).

## Decision

- **A notification is a type plus values,** never a sentence: `MONEY_RECEIVED` with `{ amountPaise, from, accountId, account }`. The web app words it in the reader's language (`describeNotification`), with amounts formatted for that language. The same record reads correctly in English and Hindi, and wording can change without touching stored data.
- **Created where the event happens:**
  - money received from someone else: in the transfer's MongoDB transaction ([0003](0003-mongodb-transactions.md)), so it exists exactly when the money arrived; transfers between your own accounts don't notify;
  - account frozen or unfrozen: in the admin action's transaction;
  - security: when the security event is recorded. That covers a sign-in from a browser not seen in 90 days (not the very first sign-in), a password or 2FA change, a lockout, and a blocked copied sign-in.
- **The shared demo login gets no sign-in or security notifications;** they would show visitors each other's devices.
- **Polling, not push.** The app asks `GET /api/notifications/summary` (unread count and newest id) on start, when the tab becomes visible, and every 60 seconds while it is visible. Only when the newest id changes does it fetch the list and show toasts (at most 3), and only for notifications that arrived since the page loaded.
- **The bell is deferred** (`@defer (on idle)`): signed-out visitors never download it, and the first screen doesn't wait for it.
- Notifications that change an account (money received, frozen, unfrozen) refresh the cached accounts, so balances on screen are current.
- Rows expire after 90 days (TTL index).

## Alternatives considered

- **WebSockets or Server-Sent Events:** instant, but a connection per open tab. On a free instance that sleeps, connections drop and must reconnect. A minute's delay is fine for these events.
- **Web push (service worker + push service):** reaches a closed browser, but needs permission prompts, VAPID keys and a push provider. Worth it for a real bank's payment alerts, too much for this step.
- **Storing the sentence:** simplest to show, but fixed to one language and one wording forever.
- **Email or SMS:** needs a provider and verified addresses; out of scope for now.

## Consequences

- New notifications appear within about a minute while the app is open, and on the next visit otherwise (badge only, no toast flood).
- Each open, visible tab makes one small request a minute. Hidden tabs make none.
- A new notification type needs: the type in the shared schema, where it is created, wording in `describeNotification` (English and Hindi), and a link.
