import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * Encrypts small secrets (2FA seeds) before they go into MongoDB, so a
 * database leak alone doesn't let anyone generate a user's codes.
 *
 * AES-256-GCM: confidentiality + integrity (tampered data fails to decrypt).
 * The key is derived from an env variable with SHA-256, so any long random
 * string works as the configured value.
 */
const VERSION = 'v1';

function key(material: string): Buffer {
  return createHash('sha256').update(material).digest();
}

export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(keyMaterial), iv);
  const data = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
    .join('.');
}

export function decryptSecret(box: string, keyMaterial: string): string {
  const [version, iv, tag, data] = box.split('.');
  if (version !== VERSION || !data) throw new Error('Unknown secret format');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(keyMaterial),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
