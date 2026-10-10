import { z } from 'zod';
import request from 'supertest';
import { SessionDtoSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { UserModel } from './user.model';

describe('shared demo accounts', () => {
  const app = createApp(testConfig());
  let email: string;
  let userId: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ email, userId } = await signUp(app, 'Priya Sharma'));
    await UserModel.updateOne({ _id: userId }, { demo: true });
  });

  /** A visitor signing in to the demo account from their own browser. */
  async function visitor(userAgent: string) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password: 'secret123' })
      .expect(200);
    return { Authorization: `Bearer ${res.body.accessToken}` };
  }

  it('says it is a demo account', async () => {
    const auth = await visitor('Chrome');
    const me = await request(app).get('/api/auth/me').set(auth).expect(200);
    expect(me.body.demo).toBe(true);
  });

  it.each([
    [
      'change the password',
      'post',
      '/api/security/password',
      { currentPassword: 'secret123', newPassword: 'hijacked1' },
    ],
    ['start 2FA setup', 'post', '/api/security/mfa/setup', {}],
    ['turn on 2FA', 'post', '/api/security/mfa/enable', { code: '123456' }],
    [
      'sign out other devices',
      'post',
      '/api/security/sessions/revoke-others',
      {},
    ],
    ['sign out a device', 'delete', '/api/security/sessions/some-session', {}],
  ] as const)('refuses to %s', async (_name, method, path, body) => {
    const auth = await visitor('Chrome');

    const res = await request(app)
      [method](path)
      .set(auth)
      .send(body)
      .expect(403);

    expect(res.body.error.code).toBe('DEMO_ACCOUNT');
  });

  it('keeps the published password working', async () => {
    const auth = await visitor('Chrome');
    await request(app)
      .post('/api/security/password')
      .set(auth)
      .send({ currentPassword: 'secret123', newPassword: 'hijacked1' })
      .expect(403);

    await visitor('Firefox');
  });

  it("shows each visitor only their own session, not other visitors' devices", async () => {
    await visitor('Someone else on Safari');
    const auth = await visitor('Me on Chrome');

    const list = z
      .array(SessionDtoSchema)
      .parse(
        (await request(app).get('/api/security/sessions').set(auth).expect(200))
          .body,
      );

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ current: true, userAgent: 'Me on Chrome' });
  });

  it('is never locked by wrong passwords', async () => {
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    await visitor('Chrome');
  });

  it('still locks an ordinary account after 5 wrong passwords', async () => {
    const other = await signUp(app, 'Ravi Kumar');
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: other.email, password: 'wrong-password' })
        .expect(401);
    }

    await request(app)
      .post('/api/auth/login')
      .send({ email: other.email, password: 'secret123' })
      .expect(423);
  });
});
