# 0005. Access token in memory, rotating refresh token in a cookie

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

A single-page app needs to stay signed in across reloads without exposing a long-lived credential to JavaScript, where any cross-site scripting bug could steal it. Signing out a device, or detecting a stolen token, must also be possible, which plain stateless JWTs can't do.

## Decision

- **Access token:** a JWT (HS256, 15 minutes) returned in the JSON body and kept **in memory only**, never in `localStorage`. Claims: `sub`, `role`, `mfa`, `sid` (session id).
- **Refresh token:** a random opaque value in an `nb_rt` cookie: `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` in production, 7 days. The database stores only its SHA-256 hash, grouped by session (one sign-in on one device).
- **Rotation:** every refresh revokes the old token and issues a new one. Reusing a **rotated** token is treated as theft and revokes all of the user's sessions, except within a **30-second grace period**, which covers lost responses and two tabs refreshing together. Tokens ended by logout or "sign out this device" just stop working.
- **`nb_session` hint cookie:** readable by JavaScript but secret-free; it only tells the app whether calling `/refresh` on page load is worth it.

## Alternatives considered

- **JWT in `localStorage`:** survives reloads, but any XSS can read it.
- **Server sessions only (session-id cookie):** simple, but every request needs a session lookup.
- **Long-lived access tokens:** can't be revoked.

## Consequences

- Same-origin hosting (Express serves Angular) makes `SameSite=Strict` possible with no CORS. Splitting the frontend onto another domain would need this revisited.
- Signing out a device stops its refresh, but its current access token works for up to 15 minutes.
- Bugs found and fixed along the way (see the [learning log](../learning-log.md)): refresh sharing the strict login rate limit, lost responses triggering theft detection, and signed-out devices triggering it too.
