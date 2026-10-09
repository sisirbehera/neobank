import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238), the codes shown by Google
 * Authenticator, Microsoft Authenticator, Authy, 1Password, …
 *
 *   code = last 6 digits of HMAC-SHA1(secret, floor(unix time / 30))
 *
 * The phone and the server share the secret once (QR code); afterwards both
 * compute the same code every 30 seconds without talking to each other.
 */

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A new random 160-bit secret, base32-encoded (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 30-second time step a moment falls in. */
export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / PERIOD_SECONDS);
}

/** The code for a given time step. */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret))
    .update(counter)
    .digest();

  // "Dynamic truncation" (RFC 4226 §5.3): pick 4 bytes based on the last nibble.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Checks a code, allowing one step of clock drift either way.
 * Returns the matching time step (to block reuse), or null.
 */
export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now(),
): number | null {
  const now = totpStep(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(totpCode(secret, step));
    const given = Buffer.from(code.padEnd(DIGITS).slice(0, DIGITS));
    if (timingSafeEqual(expected, given) && code.length === DIGITS) return step;
  }
  return null;
}

/** otpauth:// link encoded in the QR code. */
export function totpUri(secret: string, accountName: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
