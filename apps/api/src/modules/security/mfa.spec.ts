import request from 'supertest';
import {
  AuthResponseSchema,
  EnrollConfirmResponseSchema,
  MfaChallengeSchema,
  MfaSetupResponseSchema,
} from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { enableMfa, jwtClaims, useTotpClock } from '../../test/test-mfa';
import { signAccessToken } from '../auth/tokens';
import { UserModel } from '../users/user.model';

type Auth = { Authorization: string };

describe('two-step verification', () => {
  const config = testConfig();
  const app = createApp(config);
  let clock: ReturnType<typeof useTotpClock>;
  let auth: Auth;
  let email: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    clock = useTotpClock();
    ({ auth, email } = await signUp(app, 'Asha Rao'));
  });
  afterEach(() => vi.restoreAllMocks());

  const login = (password = 'secret123') =>
    request(app).post('/api/auth/login').send({ email, password });
  const verify = (mfaToken: string, code: string) =>
    request(app).post('/api/auth/mfa/verify').send({ mfaToken, code });

  describe('setup', () => {
    it('shows a QR code and only turns on after a correct code', async () => {
      const setup = await request(app)
        .post('/api/security/mfa/setup')
        .set(auth);
      const { secret, qrCodeDataUrl, otpauthUrl } =
        MfaSetupResponseSchema.parse(setup.body);
      expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(otpauthUrl).toContain(`secret=${secret}`);

      const wrong = await request(app)
        .post('/api/security/mfa/enable')
        .set(auth)
        .send({ code: '000000' });
      expect(wrong.status).toBe(400);

      const ok = await request(app)
        .post('/api/security/mfa/enable')
        .set(auth)
        .send({ code: clock.code(secret) });
      expect(ok.status).toBe(200);
      expect(ok.body.backupCodes).toHaveLength(10);
      expect(ok.body.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      const me = await request(app).get('/api/auth/me').set(auth);
      expect(me.body.mfaEnabled).toBe(true);
    });

    it('stores the secret encrypted and backup codes hashed', async () => {
      const { secret, backupCodes } = await enableMfa(app, auth, clock.code);

      const user = await UserModel.findOne({ email }).select(
        '+mfa.secretEnc +mfa.backupCodeHashes',
      );
      expect(user?.mfa.secretEnc).toMatch(/^v1\./);
      expect(user?.mfa.secretEnc).not.toContain(secret);
      expect(user?.mfa.backupCodeHashes).not.toContain(backupCodes[0]);
    });
  });

  describe('signing in', () => {
    let secret: string;
    let backupCodes: string[];

    beforeEach(async () => {
      ({ secret, backupCodes } = await enableMfa(app, auth, clock.code));
    });

    it('asks for a code instead of starting a session', async () => {
      const res = await login();

      expect(res.status).toBe(200);
      expect(MfaChallengeSchema.parse(res.body).method).toBe('VERIFY');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('starts a 2FA session with a correct code', async () => {
      const { mfaToken } = (await login()).body;

      const res = await verify(mfaToken, clock.code(secret));

      expect(res.status).toBe(200);
      const session = AuthResponseSchema.parse(res.body);
      expect(jwtClaims(session.accessToken)).toMatchObject({ mfa: true });
      expect(String(res.headers['set-cookie'])).toContain('nb_rt=');
    });

    it('rejects a wrong code and a reused code', async () => {
      const { mfaToken } = (await login()).body;
      expect((await verify(mfaToken, '123456')).body.error.code).toBe(
        'INVALID_CODE',
      );

      const code = clock.code(secret);
      expect((await verify(mfaToken, code)).status).toBe(200);
      const replay = await verify(mfaToken, code);
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('CODE_ALREADY_USED');
    });

    it('accepts each backup code exactly once', async () => {
      const { mfaToken } = (await login()).body;

      expect(
        (await verify(mfaToken, backupCodes[0].toLowerCase())).status,
      ).toBe(200);
      expect((await verify(mfaToken, backupCodes[0])).status).toBe(401);
    });

    it('locks the account after 5 wrong codes', async () => {
      const { mfaToken } = (await login()).body;
      for (let i = 0; i < 5; i++) await verify(mfaToken, '000000');

      const res = await verify(mfaToken, clock.code(secret));
      expect(res.status).toBe(423);
    });

    it('does not accept the challenge token as an access token, or after it expires', async () => {
      const { mfaToken } = (await login()).body;
      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${mfaToken}`);
      expect(me.status).toBe(401);

      clock.advance(6 * 60_000); // challenge tokens live 5 minutes
      const late = await verify(mfaToken, clock.code(secret));
      expect(late.body.error.code).toBe('MFA_TOKEN_INVALID');
    });
  });

  describe('turning it off', () => {
    it('needs the password and a code', async () => {
      const { secret } = await enableMfa(app, auth, clock.code);
      const disable = (password: string, code: string) =>
        request(app)
          .post('/api/security/mfa/disable')
          .set(auth)
          .send({ password, code });

      expect((await disable('wrong-pass1', clock.code(secret))).status).toBe(
        400,
      );
      expect((await disable('secret123', '000000')).status).toBe(401);
      expect((await disable('secret123', clock.code(secret))).status).toBe(204);

      expect((await login()).body.accessToken).toBeDefined();
    });
  });

  describe('admins', () => {
    beforeEach(async () => {
      await UserModel.updateOne({ email }, { role: 'admin' });
    });

    it('must set up 2FA on their first sign-in', async () => {
      const challenge = MfaChallengeSchema.parse((await login()).body);
      expect(challenge.method).toBe('ENROLL');

      const setup = await request(app)
        .post('/api/auth/mfa/enroll/start')
        .send({ mfaToken: challenge.mfaToken });
      const confirm = await request(app)
        .post('/api/auth/mfa/enroll/confirm')
        .send({
          mfaToken: challenge.mfaToken,
          code: clock.code(setup.body.secret),
        });

      expect(confirm.status).toBe(200);
      const body = EnrollConfirmResponseSchema.parse(confirm.body);
      expect(body.backupCodes).toHaveLength(10);
      expect(body.user).toMatchObject({ role: 'admin', mfaEnabled: true });

      const stats = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${body.accessToken}`);
      expect(stats.status).toBe(200);
    });

    it('cannot use admin routes from a session without 2FA', async () => {
      const user = await UserModel.findOne({ email });
      const token = signAccessToken(
        { sub: String(user?.id), role: 'admin', mfa: false },
        config.auth.accessTokenSecret,
        15,
      );

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MFA_REQUIRED');
    });

    it('cannot turn 2FA off', async () => {
      const { secret } = await enableMfa(app, auth, clock.code);
      const res = await request(app)
        .post('/api/security/mfa/disable')
        .set(auth)
        .send({ password: 'secret123', code: clock.code(secret) });
      expect(res.status).toBe(403);
    });
  });
});
