import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { adminCredentials, loadEnv, toAppConfig } from './env';

describe('env', () => {
  it('accepts .env.example copied as-is (empty values mean "not set")', () => {
    const example = parse(
      readFileSync(join(__dirname, '../../../../.env.example')),
    );

    const env = loadEnv(example);

    expect(env.SEED_DEMO_DATA).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
    expect(toAppConfig(env).demoDataEnabled).toBe(true); // development default
    expect(adminCredentials(env)).toEqual({
      email: 'admin@neobank.dev',
      password: 'Admin@1234',
    });
  });

  it('has no admin and no demo data in production unless configured', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://example',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      MFA_ENCRYPTION_KEY: 'y'.repeat(40),
    });

    expect(toAppConfig(env).demoDataEnabled).toBe(false);
    expect(adminCredentials(env)).toBeNull();
  });
});
