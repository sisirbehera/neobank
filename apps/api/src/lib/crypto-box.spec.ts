import { decryptSecret, encryptSecret } from './crypto-box';

describe('crypto box', () => {
  const key = 'test-key-material';

  it('round-trips and never stores the plaintext', () => {
    const box = encryptSecret('JBSWY3DPEHPK3PXP', key);

    expect(box).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(box, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV every time', () => {
    expect(encryptSecret('same', key)).not.toBe(encryptSecret('same', key));
  });

  it('rejects the wrong key and tampered data', () => {
    const box = encryptSecret('secret', key);
    expect(() => decryptSecret(box, 'other-key')).toThrow();

    const parts = box.split('.');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(parts.join('.'), key)).toThrow();
  });
});
