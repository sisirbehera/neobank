import type { AppConfig } from '../config/app-config';

export const TEST_SECRET = 'test-secret-that-is-long-enough-1234567890';

export function testConfig(
  overrides: Partial<AppConfig['auth']> = {},
): AppConfig {
  return {
    version: 'test',
    auth: {
      accessTokenSecret: TEST_SECRET,
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      secureCookies: false,
      rateLimit: 1000,
      mfaEncryptionKey: 'test-mfa-encryption-key',
      ...overrides,
    },
    demoDataEnabled: true,
  };
}
