import { z } from 'zod';
import request from 'supertest';
import { SecurityEventDtoSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { enableMfa, useTotpClock } from '../../test/test-mfa';
import { REUSE_GRACE_MS } from '../auth/auth.service';
import { RefreshTokenModel } from '../auth/refresh-token.model';
import { UserModel } from '../users/user.model';

describe('security activity', () => {
  const app = createApp(testConfig());
  let email: string;
  let userId: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ email, userId } = await signUp(app, 'Asha Rao'));
  });
  afterEach(() => vi.restoreAllMocks());

  const login = (userAgent: string, password = 'secret123') =>
    request(app)
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password });

  async function device(userAgent: string) {
    const res = await login(userAgent).expect(200);
    return { Authorization: `Bearer ${res.body.accessToken}` };
  }

  const activity = async (auth: { Authorization: string }) =>
    z
      .array(SecurityEventDtoSchema)
      .parse(
        (await request(app).get('/api/security/activity').set(auth).expect(200))
          .body,
      );

  it('lists sign-ins and failed attempts, newest first, marking this session', async () => {
    await login('Thief on Firefox', 'wrong-password').expect(401);
    const auth = await device('Laptop Chrome');

    const events = await activity(auth);

    expect(events.map((e) => e.type)).toEqual([
      'SIGNED_IN',
      'SIGN_IN_FAILED',
      'SIGNED_IN', // registration
    ]);
    expect(events[0]).toMatchObject({
      userAgent: 'Laptop Chrome',
      current: true,
    });
    expect(events[1]).toMatchObject({
      userAgent: 'Thief on Firefox',
      current: false,
    });
  });

  it('does not add a row for every token refresh', async () => {
    const res = await login('Laptop Chrome').expect(200);
    const cookie = String(res.headers['set-cookie']).split(';')[0];
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    expect(await activity(auth)).toHaveLength(2);
  });

  it('records a lockout after 5 wrong passwords', async () => {
    for (let i = 0; i < 5; i++) await login('Guesser', 'wrong').expect(401);
    await UserModel.updateOne({ _id: userId }, { $unset: { lockedUntil: '' } });

    const types = (await activity(await device('Owner'))).map((e) => e.type);

    expect(types).toContain('ACCOUNT_LOCKED');
  });

  it('records password, 2FA and device changes', async () => {
    const clock = useTotpClock();
    const laptop = await device('Laptop Chrome');
    await device('Phone Safari');

    const { secret } = await enableMfa(app, laptop, clock.code);
    await request(app)
      .post('/api/security/mfa/backup-codes')
      .set(laptop)
      .send({ code: clock.code(secret) })
      .expect(200);
    await request(app)
      .post('/api/security/mfa/disable')
      .set(laptop)
      .send({ password: 'secret123', code: clock.code(secret) })
      .expect(204);
    await request(app)
      .post('/api/security/sessions/revoke-others')
      .set(laptop)
      .expect(204);
    await request(app)
      .post('/api/security/password')
      .set(laptop)
      .send({ currentPassword: 'secret123', newPassword: 'newsecret456' })
      .expect(204);

    const events = await activity(laptop);

    expect(events.slice(0, 5).map((e) => e.type)).toEqual([
      'PASSWORD_CHANGED',
      'OTHER_DEVICES_SIGNED_OUT',
      'MFA_DISABLED',
      'BACKUP_CODES_REGENERATED',
      'MFA_ENABLED',
    ]);
    expect(events.slice(0, 5).every((e) => e.current)).toBe(true);
  });

  it('records a blocked stolen session', async () => {
    const res = await login('Laptop Chrome').expect(200);
    const cookie = String(res.headers['set-cookie']).split(';')[0];
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    // The same (already replaced) token comes back after the grace period.
    await RefreshTokenModel.updateMany(
      { rotatedAt: { $exists: true } },
      { $set: { rotatedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000) } },
    );
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);

    const types = (await activity(await device('Laptop Chrome'))).map(
      (e) => e.type,
    );

    expect(types).toContain('STOLEN_SESSION_BLOCKED');
  });

  it("shows a demo visitor only their own session's events", async () => {
    await UserModel.updateOne({ _id: userId }, { demo: true });
    await login('Other visitor', 'wrong').expect(401);
    await device('Other visitor');
    const auth = await device('Me on Chrome');

    const events = await activity(auth);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'SIGNED_IN',
      userAgent: 'Me on Chrome',
      current: true,
    });
  });
});
