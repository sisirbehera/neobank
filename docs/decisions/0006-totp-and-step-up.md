# 0006. TOTP on Node `crypto`, and step-up through one interceptor

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

A password alone is weak protection for a bank, both at sign-in and for risky actions such as adding a new payee. SMS codes cost money and are vulnerable to SIM swaps. Admins can freeze accounts, so their accounts need stronger protection than customers'.

## Decision

- **Authenticator-app codes (TOTP, RFC 6238)**, implemented in about 100 lines on Node's built-in `crypto` (`lib/totp.ts`) and tested against the RFC's official test vectors. Optional for customers, **mandatory for admins** (enrolment is forced at first sign-in, and admin routes check the token's `mfa` claim).
- **Storage:** the secret is encrypted with AES-256-GCM (`MFA_ENCRYPTION_KEY`); 10 backup codes are stored as SHA-256 hashes and work once each; `lastUsedStep` stops a code being used twice.
- **Two-step sign-in:** the password only earns a 5-minute challenge token with its own JWT audience, which can't be used as an access token.
- **Step-up:** for users with 2FA, adding a beneficiary or paying someone else more than ₹10,000 returns `403 STEP_UP_REQUIRED` with `meta.action`. **One Angular interceptor** opens a "Confirm it's you" dialog, exchanges a fresh code for a 5-minute single-action token, and retries the original request with `X-Step-Up-Token`.
- Wrong passwords, codes and step-up codes share one lockout counter (5 tries, 15 minutes).

## Alternatives considered

- **`otplib` / `speakeasy`:** fine libraries, but TOTP is small enough to implement and understand, and that avoids a dependency in the security path.
- **SMS or email codes:** cost money, need a provider, and are weaker.
- **Passkeys (WebAuthn):** the strongest option, but more complex; a good later addition.
- **Step-up handled in each page:** every risky form would need its own dialog logic.

## Consequences

- Pages don't know step-up exists; new risky endpoints only need `requireStepUp` on the API.
- The retry keeps the Idempotency-Key, so a step-up can't cause a double payment.
- **`MFA_ENCRYPTION_KEY` can never change** without a re-encryption script, or nobody with 2FA can sign in (see the [runbook](../runbook.md)).
