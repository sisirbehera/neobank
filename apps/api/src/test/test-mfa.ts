import request from 'supertest';
import type { Express } from 'express';
import { vi } from 'vitest';
import { totpCode, totpStep } from '../lib/totp';

/**
 * Each TOTP code works once per 30-second window. Tests that need several
 * codes move a fake clock forward 30 s per code instead of waiting.
 * (Date.now drives both TOTP and JWT expiry, so they stay consistent.)
 */
export function useTotpClock() {
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  return {
    /** A fresh, not-yet-used code. */
    code(secret: string): string {
      now += 30_000;
      return totpCode(secret, totpStep(now));
    },
    advance(ms: number) {
      now += ms;
    },
  };
}

/** Turns on 2FA for a signed-in user; returns the secret and backup codes. */
export async function enableMfa(
  app: Express,
  auth: { Authorization: string },
  code: (secret: string) => string,
): Promise<{ secret: string; backupCodes: string[] }> {
  const setup = await request(app)
    .post('/api/security/mfa/setup')
    .set(auth)
    .expect(200);
  const enabled = await request(app)
    .post('/api/security/mfa/enable')
    .set(auth)
    .send({ code: code(setup.body.secret) })
    .expect(200);
  return { secret: setup.body.secret, backupCodes: enabled.body.backupCodes };
}

/** Reads the claims of a JWT (no verification: for assertions only). */
export function jwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}
