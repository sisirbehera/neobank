import request from 'supertest';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { enableMfa, useTotpClock } from '../../test/test-mfa';
import { openAccount } from '../../test/test-money';

type Auth = { Authorization: string };

describe('step-up verification for risky actions', () => {
  const app = createApp(testConfig());
  let clock: ReturnType<typeof useTotpClock>;
  let auth: Auth;
  let mine: { id: string; accountNumber: string };
  let myOther: { id: string; accountNumber: string };
  let ravi: { id: string; accountNumber: string };

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    clock = useTotpClock();
    ({ auth } = await signUp(app, 'Asha Rao'));
    mine = await openAccount(app, auth, 1_00_000_00);
    myOther = await openAccount(app, auth, 0, 'CURRENT');
    ravi = await openAccount(app, (await signUp(app, 'Ravi Kumar')).auth);
  });
  afterEach(() => vi.restoreAllMocks());

  const addBeneficiary = (stepUpToken?: string) => {
    const req = request(app)
      .post('/api/beneficiaries')
      .set(auth)
      .send({ name: 'Ravi', accountNumber: ravi.accountNumber });
    return stepUpToken ? req.set('X-Step-Up-Token', stepUpToken) : req;
  };

  const transfer = (
    toAccountNumber: string,
    amountPaise: number,
    {
      key = crypto.randomUUID(),
      stepUpToken,
    }: { key?: string; stepUpToken?: string } = {},
  ) => {
    const req = request(app)
      .post('/api/transfers')
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ fromAccountId: mine.id, toAccountNumber, amountPaise });
    return stepUpToken ? req.set('X-Step-Up-Token', stepUpToken) : req;
  };

  const stepUp = async (action: string, code: string) =>
    (
      await request(app)
        .post('/api/security/step-up')
        .set(auth)
        .send({ action, code })
        .expect(200)
    ).body.stepUpToken as string;

  it('is not asked of users without 2FA (it is optional for customers)', async () => {
    await addBeneficiary().expect(201);
    await transfer(ravi.accountNumber, 50_000_00).expect(201);
  });

  describe('with 2FA on', () => {
    let secret: string;

    beforeEach(async () => {
      ({ secret } = await enableMfa(app, auth, clock.code));
    });

    it('needs a fresh code to add a beneficiary', async () => {
      const blocked = await addBeneficiary();
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toMatchObject({
        code: 'STEP_UP_REQUIRED',
        meta: { action: 'ADD_BENEFICIARY' },
      });

      const token = await stepUp('ADD_BENEFICIARY', clock.code(secret));
      expect((await addBeneficiary(token)).status).toBe(201);
    });

    it('checks the input before asking for a code', async () => {
      const res = await request(app)
        .post('/api/beneficiaries')
        .set(auth)
        .send({ name: 'Me', accountNumber: myOther.accountNumber });
      expect(res.status).toBe(400); // own account, no code requested
    });

    it('does not accept a token issued for a different action', async () => {
      const token = await stepUp('LARGE_TRANSFER', clock.code(secret));
      expect((await addBeneficiary(token)).status).toBe(403);
    });

    it('needs a code only for transfers to others above ₹10,000', async () => {
      await addBeneficiary(await stepUp('ADD_BENEFICIARY', clock.code(secret)));

      await transfer(ravi.accountNumber, 10_000_00).expect(201); // exactly ₹10,000
      await transfer(myOther.accountNumber, 50_000_00).expect(201); // own account

      const blocked = await transfer(ravi.accountNumber, 10_000_01);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.meta.action).toBe('LARGE_TRANSFER');

      const key = crypto.randomUUID();
      const token = await stepUp('LARGE_TRANSFER', clock.code(secret));
      await transfer(ravi.accountNumber, 10_000_01, {
        key,
        stepUpToken: token,
      }).expect(201);

      // A retry of the same transfer replays the result (no second code needed).
      const retry = await transfer(ravi.accountNumber, 10_000_01, { key });
      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
    });

    it('expires step-up tokens after 5 minutes', async () => {
      const token = await stepUp('ADD_BENEFICIARY', clock.code(secret));
      clock.advance(6 * 60_000);
      expect((await addBeneficiary(token)).status).toBe(403);
    });

    it('counts wrong step-up codes towards the lockout', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/security/step-up')
          .set(auth)
          .send({ action: 'ADD_BENEFICIARY', code: '000000' });
      }
      const res = await request(app)
        .post('/api/security/step-up')
        .set(auth)
        .send({ action: 'ADD_BENEFICIARY', code: clock.code(secret) });
      expect(res.status).toBe(423);
    });
  });
});
