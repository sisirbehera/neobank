import { z } from 'zod';
import request from 'supertest';
import { SessionDtoSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';

describe('password and sessions', () => {
  const app = createApp(testConfig());
  let email: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ email } = await signUp(app, 'Asha Rao'));
  });

  /** Signs in "on another device": returns its bearer header and refresh cookie. */
  async function device(userAgent: string, password = 'secret123') {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password })
      .expect(200);
    const cookie = String(res.headers['set-cookie']).split(';')[0];
    return {
      auth: { Authorization: `Bearer ${res.body.accessToken}` },
      refresh: () =>
        request(app)
          .post('/api/auth/refresh')
          .set('Cookie', cookie)
          .set('User-Agent', userAgent),
    };
  }

  const sessions = async (auth: { Authorization: string }) =>
    z
      .array(SessionDtoSchema)
      .parse(
        (await request(app).get('/api/security/sessions').set(auth).expect(200))
          .body,
      );

  it('lists one row per device and marks the current one', async () => {
    const laptop = await device('Laptop Chrome');
    await device('Phone Safari');
    // The registration sign-in is a third session.

    const list = await sessions(laptop.auth);

    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    expect(list.find((s) => s.current)?.userAgent).toBe('Laptop Chrome');
  });

  it('keeps the same session across token refreshes', async () => {
    const laptop = await device('Laptop Chrome');
    const before = (await sessions(laptop.auth)).find((s) => s.current);

    const refreshed = await laptop.refresh().expect(200);
    const after = await sessions({
      Authorization: `Bearer ${refreshed.body.accessToken}`,
    });

    expect(after).toHaveLength(2);
    expect(after.find((s) => s.current)?.id).toBe(before?.id);
  });

  it('signs out one device without touching the others', async () => {
    const laptop = await device('Laptop Chrome');
    const phone = await device('Phone Safari');
    const phoneSession = (await sessions(phone.auth)).find((s) => s.current);

    await request(app)
      .delete(`/api/security/sessions/${phoneSession?.id}`)
      .set(laptop.auth)
      .expect(204);

    expect((await phone.refresh()).status).toBe(401);
    // The signed-out phone retrying is NOT treated as theft: laptop still works.
    expect((await laptop.refresh()).status).toBe(200);

    const unknown = await request(app)
      .delete('/api/security/sessions/nope')
      .set(laptop.auth);
    expect(unknown.status).toBe(404);
  });

  it('signs out every other device', async () => {
    const laptop = await device('Laptop Chrome');
    const phone = await device('Phone Safari');

    await request(app)
      .post('/api/security/sessions/revoke-others')
      .set(laptop.auth)
      .expect(204);

    expect((await phone.refresh()).status).toBe(401);
    expect(await sessions(laptop.auth)).toHaveLength(1);
  });

  describe('changing the password', () => {
    const change = (auth: { Authorization: string }, body: object) =>
      request(app).post('/api/security/password').set(auth).send(body);

    it('requires the current password', async () => {
      const laptop = await device('Laptop Chrome');

      const res = await change(laptop.auth, {
        currentPassword: 'wrong-pass1',
        newPassword: 'better-pass2',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.fields.currentPassword).toHaveLength(1);
    });

    it('rejects reusing the same password', async () => {
      const laptop = await device('Laptop Chrome');
      const res = await change(laptop.auth, {
        currentPassword: 'secret123',
        newPassword: 'secret123',
      });
      expect(res.body.error.fields.newPassword).toHaveLength(1);
    });

    it('changes it and signs out the other devices only', async () => {
      const laptop = await device('Laptop Chrome');
      const phone = await device('Phone Safari');

      await change(laptop.auth, {
        currentPassword: 'secret123',
        newPassword: 'better-pass2',
      }).expect(204);

      expect((await phone.refresh()).status).toBe(401);
      expect((await laptop.refresh()).status).toBe(200);
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'secret123' })
        .expect(401);
      await device('New login', 'better-pass2');
    });
  });
});
