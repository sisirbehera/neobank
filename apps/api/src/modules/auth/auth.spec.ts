import request from 'supertest';
import {
  ApiErrorSchema,
  AuthResponseSchema,
  UserDtoSchema,
} from '@neobank/shared/models';
import { createApp } from '../../app';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { testConfig } from '../../test/test-config';
import { UserModel } from '../users/user.model';
import { REFRESH_COOKIE } from './auth.routes';

const user = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  password: 'secret123',
};

/** Extracts "nb_rt=<value>" from a response's Set-Cookie header. */
function refreshCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0];
}

function errorCode(res: request.Response): string {
  return ApiErrorSchema.parse(res.body).error.code;
}

describe('auth API', () => {
  const app = createApp(testConfig());

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(clearTestDb);

  const register = (body: object = user) =>
    request(app).post('/api/auth/register').send(body);
  const login = (body: object = user) =>
    request(app).post('/api/auth/login').send(body);
  const refresh = (cookie?: string) => {
    const req = request(app).post('/api/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  describe('register', () => {
    it('creates the user, returns a session and sets an httpOnly cookie', async () => {
      const res = await register();

      expect(res.status).toBe(201);
      const body = AuthResponseSchema.parse(res.body);
      expect(body.user).toMatchObject({
        name: 'Asha Rao',
        email: 'asha@example.com',
        role: 'customer',
      });
      expect(res.body.user.passwordHash).toBeUndefined();

      const setCookie = String(res.headers['set-cookie']);
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/SameSite=Strict/);
      expect(setCookie).toMatch(/Path=\/api\/auth/);
    });

    it('stores a hashed password, never the plain text', async () => {
      await register();
      const stored = await UserModel.findOne({ email: user.email }).select(
        '+passwordHash',
      );
      expect(stored?.passwordHash).toMatch(/^scrypt\$/);
      expect(stored?.passwordHash).not.toContain(user.password);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await register();
      const res = await register({ ...user, email: 'ASHA@example.com' });

      expect(res.status).toBe(409);
      expect(errorCode(res)).toBe('EMAIL_TAKEN');
      expect(res.body.error.fields.email).toHaveLength(1);
    });

    it('returns field errors for invalid input', async () => {
      const res = await register({
        name: 'A',
        email: 'nope',
        password: 'weak',
      });

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.fields).sort()).toEqual([
        'email',
        'name',
        'password',
      ]);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register();
    });

    it('returns a session for valid credentials', async () => {
      const res = await login({ ...user, email: 'Asha@Example.com' });

      expect(res.status).toBe(200);
      expect(AuthResponseSchema.parse(res.body).user.email).toBe(user.email);
      expect(refreshCookie(res)).toBeTruthy();
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ ...user, password: 'wrong123' });
      const unknownEmail = await login({ ...user, email: 'who@example.com' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('locks the account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await login({ ...user, password: 'wrong123' });
      }

      const res = await login(); // correct password, but locked
      expect(res.status).toBe(423);
      expect(errorCode(res)).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('access token', () => {
    it('authorises GET /me', async () => {
      const { accessToken } = (await register()).body;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(UserDtoSchema.parse(res.body).email).toBe(user.email);
    });

    it.each([
      ['no token', undefined],
      ['a garbage token', 'Bearer not-a-jwt'],
    ])('rejects GET /me with %s', async (_label, header) => {
      const req = request(app).get('/api/auth/me');
      const res = await (header ? req.set('Authorization', header) : req);

      expect(res.status).toBe(401);
    });

    it('rejects a token signed with another secret', async () => {
      const other = createApp(
        testConfig({ accessTokenSecret: 'x'.repeat(40) }),
      );
      const { accessToken } = (
        await request(other).post('/api/auth/register').send(user)
      ).body;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token on every use', async () => {
      const first = refreshCookie(await register());

      const res = await refresh(first);

      expect(res.status).toBe(200);
      expect(AuthResponseSchema.parse(res.body).user.email).toBe(user.email);
      expect(refreshCookie(res)).not.toBe(first);
    });

    it('revokes every session when an old token is reused', async () => {
      const stolen = refreshCookie(await register());
      const current = refreshCookie(await refresh(stolen));

      const replay = await refresh(stolen);
      expect(replay.status).toBe(401);

      // The legitimate, newer token has been revoked too.
      expect((await refresh(current)).status).toBe(401);
    });

    it('returns 401 without a cookie', async () => {
      const res = await refresh();

      expect(res.status).toBe(401);
      expect(errorCode(res)).toBe('SESSION_EXPIRED');
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const cookie = refreshCookie(await register());

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(res.status).toBe(204);
      expect(String(res.headers['set-cookie'])).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
      expect((await refresh(cookie)).status).toBe(401);
    });
  });

  it('rate limits auth requests per IP', async () => {
    const limited = createApp(testConfig({ rateLimit: 2 }));
    const attempt = () => request(limited).post('/api/auth/login').send(user);

    await attempt();
    await attempt();
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(errorCode(res)).toBe('TOO_MANY_REQUESTS');
  });
});
