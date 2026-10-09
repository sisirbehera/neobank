import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  totpCode,
  totpStep,
  totpUri,
  verifyTotp,
} from './totp';

// RFC 6238 Appendix B test secret ("12345678901234567890", SHA-1).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it.each([
    [59, '287082'], // RFC value 94287082, last 6 digits
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC 6238 test vector at t=%i', (seconds, code) => {
    expect(totpCode(RFC_SECRET, totpStep(seconds * 1000))).toBe(code);
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from('any bytes ÿ\u0000');
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('accepts the current code and one step of clock drift, nothing more', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const step = totpStep(now);

    expect(verifyTotp(secret, totpCode(secret, step), now)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), now)).toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
  });

  it('builds an otpauth link for the QR code', () => {
    expect(totpUri('ABC', 'asha@example.com', 'NeoBank')).toBe(
      'otpauth://totp/NeoBank%3Aasha%40example.com?secret=ABC&issuer=NeoBank&algorithm=SHA1&digits=6&period=30',
    );
  });
});
