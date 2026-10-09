import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserRoleSchema } from '@neobank/shared/models';

const ISSUER = 'neobank-api';
const AUDIENCE = 'neobank-web';

const AccessTokenPayloadSchema = z.object({
  sub: z.string(),
  role: UserRoleSchema,
});

export type AccessTokenClaims = z.infer<typeof AccessTokenPayloadSchema>;

export function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  ttlMinutes: number,
): string {
  return jwt.sign({ role: claims.role }, secret, {
    subject: claims.sub,
    algorithm: 'HS256',
    expiresIn: ttlMinutes * 60,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/** Returns the claims, or null if the token is invalid, expired or tampered with. */
export function verifyAccessToken(
  token: string,
  secret: string,
): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const result = AccessTokenPayloadSchema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Refresh tokens are opaque random strings, not JWTs: they're looked up in the DB. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
