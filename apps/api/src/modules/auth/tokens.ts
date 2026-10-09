import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StepUpActionSchema, UserRoleSchema } from '@neobank/shared/models';

const ISSUER = 'neobank-api';

/**
 * Three kinds of JWT, all signed with the same secret but with a different
 * `aud` (audience). jwt.verify() checks the audience, so a token of one kind
 * can never be accepted as another (e.g. a step-up token as an access token).
 */
const AUDIENCE = {
  access: 'neobank-web',
  mfaChallenge: 'neobank-mfa',
  stepUp: 'neobank-step-up',
} as const;

function sign(
  payload: object,
  subject: string,
  audience: string,
  secret: string,
  ttlSeconds: number,
): string {
  return jwt.sign(payload, secret, {
    subject,
    algorithm: 'HS256',
    expiresIn: ttlSeconds,
    issuer: ISSUER,
    audience,
  });
}

function verify<T extends z.ZodType>(
  token: string,
  audience: string,
  secret: string,
  schema: T,
): z.infer<T> | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience,
    });
    const result = schema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---- Access tokens ----------------------------------------------------------

const AccessTokenPayloadSchema = z.object({
  sub: z.string(),
  role: UserRoleSchema,
  /** The session was started with two-step verification. */
  mfa: z.boolean().default(false),
  /** Session id (one sign-in on one device), for "sign out other devices". */
  sid: z.string().default(''),
});

export type AccessTokenClaims = z.infer<typeof AccessTokenPayloadSchema>;

export function signAccessToken(
  claims: z.input<typeof AccessTokenPayloadSchema>,
  secret: string,
  ttlMinutes: number,
): string {
  return sign(
    { role: claims.role, mfa: claims.mfa ?? false, sid: claims.sid ?? '' },
    claims.sub,
    AUDIENCE.access,
    secret,
    ttlMinutes * 60,
  );
}

/** Returns the claims, or null if the token is invalid, expired or tampered with. */
export function verifyAccessToken(
  token: string,
  secret: string,
): AccessTokenClaims | null {
  return verify(token, AUDIENCE.access, secret, AccessTokenPayloadSchema);
}

// ---- MFA challenge tokens (between the password step and the code step) ----

const MfaChallengeSchema = z.object({
  sub: z.string(),
  purpose: z.enum(['VERIFY', 'ENROLL']),
});
export type MfaChallengeClaims = z.infer<typeof MfaChallengeSchema>;

export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

export function signMfaChallenge(
  { sub, purpose }: MfaChallengeClaims,
  secret: string,
): string {
  return sign(
    { purpose },
    sub,
    AUDIENCE.mfaChallenge,
    secret,
    MFA_CHALLENGE_TTL_SECONDS,
  );
}

export function verifyMfaChallenge(
  token: string,
  secret: string,
): MfaChallengeClaims | null {
  return verify(token, AUDIENCE.mfaChallenge, secret, MfaChallengeSchema);
}

// ---- Step-up tokens (a fresh 2FA code for one kind of risky action) ---------

const StepUpSchema = z.object({ sub: z.string(), action: StepUpActionSchema });
export type StepUpClaims = z.infer<typeof StepUpSchema>;

export const STEP_UP_TTL_SECONDS = 5 * 60;

export function signStepUp({ sub, action }: StepUpClaims, secret: string) {
  return sign({ action }, sub, AUDIENCE.stepUp, secret, STEP_UP_TTL_SECONDS);
}

export function verifyStepUp(
  token: string,
  secret: string,
): StepUpClaims | null {
  return verify(token, AUDIENCE.stepUp, secret, StepUpSchema);
}

// ---- Refresh tokens -----------------------------------------------------------

/** Refresh tokens are opaque random strings, not JWTs: they're looked up in the DB. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
